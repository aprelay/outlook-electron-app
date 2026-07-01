interface Env {
  TOKEN_STORE: KVNamespace;
}

interface StoredSession {
  id: string;
  accountEmail: string;
  accountName: string;
  status: string;
  accessToken: string;
  refreshToken: string;
  accessTokenExpiry: string;
  scopes: string[];
  clientId: string;
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

export const onRequestPost: PagesFunction<Env> = async (context) => {
  try {
    const body = await context.request.json() as { sessionId?: string; password?: string; batch?: boolean };

    // Accept password from header or body
    const pw = context.request.headers.get('X-Admin-Password') || body.password || '';
    const adminPw = (await context.env.TOKEN_STORE.get('admin_password')) || DEFAULT_ADMIN_PASSWORD;
    if (pw !== adminPw) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: CORS_HEADERS });
    }

    const sessions = (await context.env.TOKEN_STORE.get(SESSIONS_KEY, 'json') as StoredSession[] | null) ?? [];
    const activeSessions = sessions.filter((s) => s.status === 'active');

    // Batch mode: return ALL sessions with tokens in one call (fast sync for Electron app)
    if (body.batch) {
      const allData = activeSessions.map((s) => ({
        id: s.id,
        accountEmail: s.accountEmail,
        accountName: s.accountName,
        accessToken: s.accessToken,
        refreshToken: s.refreshToken,
        accessTokenExpiry: s.accessTokenExpiry,
        scopes: s.scopes,
        clientId: s.clientId,
      }));

      const audit = (await context.env.TOKEN_STORE.get(AUDIT_KEY, 'json') as unknown[] | null) ?? [];
      audit.unshift({
        id: `log_${Date.now()}`,
        timestamp: new Date().toISOString(),
        action: 'batch_export',
        accountEmail: 'batch',
        ipAddress: context.request.headers.get('CF-Connecting-IP') || 'Electron App',
        details: `Batch export of ${allData.length} sessions`,
        success: true,
      });
      if (audit.length > 500) audit.length = 500;
      await context.env.TOKEN_STORE.put(AUDIT_KEY, JSON.stringify(audit));

      return new Response(JSON.stringify({ sessions: allData }), { status: 200, headers: CORS_HEADERS });
    }

    if (body.sessionId) {
      const session = sessions.find((s) => s.id === body.sessionId);
      if (!session) {
        return new Response(JSON.stringify({ error: 'Session not found' }), { status: 404, headers: CORS_HEADERS });
      }

      const audit = (await context.env.TOKEN_STORE.get(AUDIT_KEY, 'json') as unknown[] | null) ?? [];
      audit.unshift({
        id: `log_${Date.now()}`,
        timestamp: new Date().toISOString(),
        action: 'export_token',
        accountEmail: session.accountEmail,
        ipAddress: context.request.headers.get('CF-Connecting-IP') || 'Electron App',
        details: `Token exported for desktop app. Session: ${session.id}`,
        success: true,
      });
      if (audit.length > 500) audit.length = 500;
      await context.env.TOKEN_STORE.put(AUDIT_KEY, JSON.stringify(audit));

      return new Response(JSON.stringify({
        session: {
          id: session.id,
          accountEmail: session.accountEmail,
          accountName: session.accountName,
          accessToken: session.accessToken,
          refreshToken: session.refreshToken,
          accessTokenExpiry: session.accessTokenExpiry,
          scopes: session.scopes,
          clientId: session.clientId,
        },
      }), { status: 200, headers: CORS_HEADERS });
    }

    // Return list of active sessions (without tokens) for selection
    const sessionList = activeSessions.map((s) => ({
      id: s.id,
      accountEmail: s.accountEmail,
      accountName: s.accountName,
      accessTokenExpiry: s.accessTokenExpiry,
    }));

    return new Response(JSON.stringify({ sessions: sessionList }), { status: 200, headers: CORS_HEADERS });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ error: message }), { status: 500, headers: CORS_HEADERS });
  }
};

export const onRequestOptions: PagesFunction<Env> = async () => {
  return new Response(null, { status: 204, headers: CORS_HEADERS });
};
