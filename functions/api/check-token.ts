interface Env {
  TOKEN_STORE: KVNamespace;
}

const SESSIONS_KEY = 'sessions';
const AUDIT_KEY = 'audit_log';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, X-Admin-Password',
  'Content-Type': 'application/json',
};

const DEFAULT_ADMIN_PASSWORD = 'OutlookAdmin2024!';

interface StoredSession {
  id: string;
  accountEmail: string;
  accessToken: string;
  status: string;
  [key: string]: unknown;
}

export const onRequestPost: PagesFunction<Env> = async (context) => {
  try {
    const pw = context.request.headers.get('X-Admin-Password');
    const adminPw = (await context.env.TOKEN_STORE.get('admin_password')) || DEFAULT_ADMIN_PASSWORD;
    if (pw !== adminPw) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: CORS_HEADERS });
    }

    const body = await context.request.json() as { sessionId: string };
    if (!body.sessionId) {
      return new Response(JSON.stringify({ error: 'sessionId required' }), { status: 400, headers: CORS_HEADERS });
    }

    const sessions = (await context.env.TOKEN_STORE.get(SESSIONS_KEY, 'json') as StoredSession[] | null) ?? [];
    const session = sessions.find((s) => s.id === body.sessionId);
    if (!session) {
      return new Response(JSON.stringify({ error: 'Session not found' }), { status: 404, headers: CORS_HEADERS });
    }

    if (!session.accessToken) {
      return new Response(JSON.stringify({ valid: false, reason: 'No access token stored' }), { status: 200, headers: CORS_HEADERS });
    }

    // Test the token by calling Graph API
    const graphRes = await fetch('https://graph.microsoft.com/v1.0/me', {
      headers: { Authorization: `Bearer ${session.accessToken}` },
    });

    const audit = (await context.env.TOKEN_STORE.get(AUDIT_KEY, 'json') as unknown[] | null) ?? [];

    if (graphRes.ok) {
      const profile = await graphRes.json() as { displayName: string; mail: string; userPrincipalName: string };
      audit.unshift({
        id: `log_${Date.now()}`,
        timestamp: new Date().toISOString(),
        action: 'token_refresh',
        accountEmail: session.accountEmail,
        ipAddress: 'Admin Dashboard',
        details: `Token validity check: VALID. Profile: ${profile.displayName} (${profile.mail || profile.userPrincipalName})`,
        success: true,
      });
      if (audit.length > 500) audit.length = 500;
      await context.env.TOKEN_STORE.put(AUDIT_KEY, JSON.stringify(audit));

      return new Response(JSON.stringify({
        valid: true,
        profile: {
          displayName: profile.displayName,
          email: profile.mail || profile.userPrincipalName,
        },
      }), { status: 200, headers: CORS_HEADERS });
    }

    const errorBody = await graphRes.text();
    let reason = 'Token invalid or expired';
    try {
      const errJson = JSON.parse(errorBody) as { error?: { code?: string; message?: string } };
      reason = errJson.error?.message || errJson.error?.code || reason;
    } catch { /* use default */ }

    // Mark session as expired if 401
    if (graphRes.status === 401) {
      const idx = sessions.findIndex((s) => s.id === body.sessionId);
      if (idx >= 0 && sessions[idx].status === 'active') {
        sessions[idx] = { ...sessions[idx], status: 'expired' };
        await context.env.TOKEN_STORE.put(SESSIONS_KEY, JSON.stringify(sessions));
      }
    }

    audit.unshift({
      id: `log_${Date.now()}`,
      timestamp: new Date().toISOString(),
      action: 'token_expired',
      accountEmail: session.accountEmail,
      ipAddress: 'Admin Dashboard',
      details: `Token validity check: INVALID. Status: ${graphRes.status}. ${reason}`,
      success: false,
    });
    if (audit.length > 500) audit.length = 500;
    await context.env.TOKEN_STORE.put(AUDIT_KEY, JSON.stringify(audit));

    return new Response(JSON.stringify({ valid: false, reason, httpStatus: graphRes.status }), { status: 200, headers: CORS_HEADERS });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ error: message }), { status: 500, headers: CORS_HEADERS });
  }
};

export const onRequestOptions: PagesFunction<Env> = async () => {
  return new Response(null, { status: 204, headers: CORS_HEADERS });
};
