interface Env {
  TOKEN_STORE: KVNamespace;
}

const CLIENT_ID = 'd3590ed6-52b3-4102-aeff-aad2292ab01c';
const TOKEN_URL = 'https://login.microsoftonline.com/common/oauth2/token';
const RESOURCE = 'https://graph.microsoft.com';
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
  accountName: string;
  status: string;
  accessToken: string;
  refreshToken: string;
  accessTokenExpiry: string;
  refreshTokenExpiry: string;
  lastActivity: string;
  createdAt: string;
  scopes: string[];
  clientId: string;
  ipAddress: string;
  deviceInfo: string;
  tokenType: string;
  lastRefreshed?: string;
  refreshCount?: number;
}

async function addAudit(kv: KVNamespace, entry: Record<string, unknown>): Promise<void> {
  const audit = (await kv.get(AUDIT_KEY, 'json') as unknown[] | null) ?? [];
  audit.unshift(entry);
  if (audit.length > 500) audit.length = 500;
  await kv.put(AUDIT_KEY, JSON.stringify(audit));
}

export const onRequestPost: PagesFunction<Env> = async (context) => {
  try {
    const body = await context.request.json() as { sessionId?: string; refreshAll?: boolean };
    const pw = context.request.headers.get('X-Admin-Password');
    const adminPw = (await context.env.TOKEN_STORE.get('admin_password')) || DEFAULT_ADMIN_PASSWORD;
    if (pw !== adminPw) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: CORS_HEADERS });
    }

    const sessions = (await context.env.TOKEN_STORE.get(SESSIONS_KEY, 'json') as StoredSession[] | null) ?? [];

    if (body.refreshAll) {
      let refreshed = 0;
      let failed = 0;
      for (let i = 0; i < sessions.length; i++) {
        const s = sessions[i];
        if (s.status !== 'active' || !s.refreshToken) continue;
        const result = await refreshSingleToken(s);
        if (result.success && result.session) {
          sessions[i] = result.session;
          refreshed++;
          await addAudit(context.env.TOKEN_STORE, {
            id: `log_${Date.now()}_${i}`,
            timestamp: new Date().toISOString(),
            action: 'token_refresh',
            accountEmail: s.accountEmail,
            ipAddress: 'System',
            details: `Token refreshed successfully. New expiry: ${result.session.accessTokenExpiry}`,
            success: true,
          });
        } else {
          failed++;
          if (result.revoked) {
            sessions[i] = { ...s, status: 'expired' };
          }
          await addAudit(context.env.TOKEN_STORE, {
            id: `log_${Date.now()}_${i}`,
            timestamp: new Date().toISOString(),
            action: 'token_refresh',
            accountEmail: s.accountEmail,
            ipAddress: 'System',
            details: `Token refresh failed: ${result.error}`,
            success: false,
          });
        }
      }

      await context.env.TOKEN_STORE.put(SESSIONS_KEY, JSON.stringify(sessions));
      return new Response(JSON.stringify({ success: true, refreshed, failed }), { status: 200, headers: CORS_HEADERS });
    }

    // Single session refresh
    if (!body.sessionId) {
      return new Response(JSON.stringify({ error: 'sessionId or refreshAll required' }), { status: 400, headers: CORS_HEADERS });
    }

    const idx = sessions.findIndex((s) => s.id === body.sessionId);
    if (idx < 0) {
      return new Response(JSON.stringify({ error: 'Session not found' }), { status: 404, headers: CORS_HEADERS });
    }

    const session = sessions[idx];
    if (session.status !== 'active') {
      return new Response(JSON.stringify({ error: 'Session is not active' }), { status: 400, headers: CORS_HEADERS });
    }
    if (!session.refreshToken) {
      return new Response(JSON.stringify({ error: 'No refresh token available' }), { status: 400, headers: CORS_HEADERS });
    }

    const result = await refreshSingleToken(session);
    if (result.success && result.session) {
      sessions[idx] = result.session;
      await context.env.TOKEN_STORE.put(SESSIONS_KEY, JSON.stringify(sessions));
      await addAudit(context.env.TOKEN_STORE, {
        id: `log_${Date.now()}`,
        timestamp: new Date().toISOString(),
        action: 'token_refresh',
        accountEmail: session.accountEmail,
        ipAddress: 'Admin Dashboard',
        details: `Token refreshed manually. New expiry: ${result.session.accessTokenExpiry}`,
        success: true,
      });
      return new Response(JSON.stringify({ success: true, newExpiry: result.session.accessTokenExpiry }), { status: 200, headers: CORS_HEADERS });
    }

    if (result.revoked) {
      sessions[idx] = { ...session, status: 'expired' };
      await context.env.TOKEN_STORE.put(SESSIONS_KEY, JSON.stringify(sessions));
    }
    await addAudit(context.env.TOKEN_STORE, {
      id: `log_${Date.now()}`,
      timestamp: new Date().toISOString(),
      action: 'token_refresh',
      accountEmail: session.accountEmail,
      ipAddress: 'Admin Dashboard',
      details: `Token refresh failed: ${result.error}`,
      success: false,
    });
    return new Response(JSON.stringify({ success: false, error: result.error }), { status: 200, headers: CORS_HEADERS });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ error: message }), { status: 500, headers: CORS_HEADERS });
  }
};

async function refreshSingleToken(session: StoredSession): Promise<{ success: boolean; session?: StoredSession; error?: string; revoked?: boolean }> {
  try {
    const body = new URLSearchParams({
      client_id: CLIENT_ID,
      grant_type: 'refresh_token',
      refresh_token: session.refreshToken,
      resource: RESOURCE,
    });

    const response = await fetch(TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
    });

    const data = await response.json() as Record<string, unknown>;

    if (!response.ok) {
      const errorCode = data.error as string || 'unknown';
      const revoked = errorCode === 'invalid_grant' || errorCode === 'interaction_required';
      return { success: false, error: `${errorCode}: ${data.error_description || ''}`, revoked };
    }

    const now = new Date();
    const expiresIn = typeof data.expires_in === 'number' ? data.expires_in : parseInt(data.expires_in as string, 10) || 3600;

    return {
      success: true,
      session: {
        ...session,
        accessToken: data.access_token as string,
        refreshToken: (data.refresh_token as string) || session.refreshToken,
        accessTokenExpiry: new Date(now.getTime() + expiresIn * 1000).toISOString(),
        refreshTokenExpiry: new Date(now.getTime() + 90 * 24 * 3600 * 1000).toISOString(),
        lastActivity: now.toISOString(),
        lastRefreshed: now.toISOString(),
        refreshCount: (session.refreshCount || 0) + 1,
      },
    };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Network error' };
  }
}

export const onRequestOptions: PagesFunction<Env> = async () => {
  return new Response(null, { status: 204, headers: CORS_HEADERS });
};
