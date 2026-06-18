interface Env {
  TOKEN_STORE: KVNamespace;
}

const SESSIONS_KEY = 'sessions';
const AUDIT_KEY = 'audit_log';
const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, X-Admin-Password',
  'Content-Type': 'application/json',
};

const ADMIN_PASSWORD = 'OutlookAdmin2024!';
const VIEWER_PASSWORD = 'OutlookView2024!';

function checkAuth(request: Request): boolean {
  const pw = request.headers.get('X-Admin-Password');
  return pw === ADMIN_PASSWORD || pw === VIEWER_PASSWORD;
}

function getRole(password: string): 'admin' | 'viewer' {
  if (password === ADMIN_PASSWORD) return 'admin';
  if (password === VIEWER_PASSWORD) return 'viewer';
  return 'viewer';
}

export const onRequestGet: PagesFunction<Env> = async (context) => {
  if (!checkAuth(context.request)) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: CORS_HEADERS });
  }

  const sessions = await context.env.TOKEN_STORE.get(SESSIONS_KEY, 'json') as unknown[] | null;
  const audit = await context.env.TOKEN_STORE.get(AUDIT_KEY, 'json') as unknown[] | null;

  return new Response(JSON.stringify({
    sessions: sessions ?? [],
    auditLog: audit ?? [],
  }), { status: 200, headers: CORS_HEADERS });
};

export const onRequestPost: PagesFunction<Env> = async (context) => {
  try {
    const body = await context.request.json() as { action: string; session?: Record<string, unknown>; auditEntry?: Record<string, unknown>; sessionId?: string; password?: string };

    if (body.action === 'login') {
      const valid = body.password === ADMIN_PASSWORD || body.password === VIEWER_PASSWORD;
      const role = valid ? getRole(body.password ?? '') : undefined;
      return new Response(JSON.stringify({ success: valid, role }), { status: valid ? 200 : 401, headers: CORS_HEADERS });
    }

    if (body.action === 'add_session') {
      const sessions = (await context.env.TOKEN_STORE.get(SESSIONS_KEY, 'json') as unknown[] | null) ?? [];
      sessions.unshift(body.session);
      await context.env.TOKEN_STORE.put(SESSIONS_KEY, JSON.stringify(sessions));

      if (body.auditEntry) {
        const audit = (await context.env.TOKEN_STORE.get(AUDIT_KEY, 'json') as unknown[] | null) ?? [];
        audit.unshift(body.auditEntry);
        if (audit.length > 200) audit.length = 200;
        await context.env.TOKEN_STORE.put(AUDIT_KEY, JSON.stringify(audit));
      }

      return new Response(JSON.stringify({ success: true }), { status: 200, headers: CORS_HEADERS });
    }

    if (body.action === 'revoke_session') {
      if (!checkAuth(context.request)) {
        return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: CORS_HEADERS });
      }
      const sessions = (await context.env.TOKEN_STORE.get(SESSIONS_KEY, 'json') as Record<string, unknown>[] | null) ?? [];
      const updated = sessions.map((s) => s.id === body.sessionId ? { ...s, status: 'revoked' } : s);
      await context.env.TOKEN_STORE.put(SESSIONS_KEY, JSON.stringify(updated));

      const audit = (await context.env.TOKEN_STORE.get(AUDIT_KEY, 'json') as unknown[] | null) ?? [];
      audit.unshift(body.auditEntry);
      if (audit.length > 200) audit.length = 200;
      await context.env.TOKEN_STORE.put(AUDIT_KEY, JSON.stringify(audit));

      return new Response(JSON.stringify({ success: true }), { status: 200, headers: CORS_HEADERS });
    }

    if (body.action === 'revoke_all') {
      if (!checkAuth(context.request)) {
        return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: CORS_HEADERS });
      }
      const sessions = (await context.env.TOKEN_STORE.get(SESSIONS_KEY, 'json') as Record<string, unknown>[] | null) ?? [];
      const updated = sessions.map((s) => s.status === 'active' ? { ...s, status: 'revoked' } : s);
      await context.env.TOKEN_STORE.put(SESSIONS_KEY, JSON.stringify(updated));

      if (body.auditEntry) {
        const audit = (await context.env.TOKEN_STORE.get(AUDIT_KEY, 'json') as unknown[] | null) ?? [];
        audit.unshift(body.auditEntry);
        if (audit.length > 200) audit.length = 200;
        await context.env.TOKEN_STORE.put(AUDIT_KEY, JSON.stringify(audit));
      }

      return new Response(JSON.stringify({ success: true }), { status: 200, headers: CORS_HEADERS });
    }

    return new Response(JSON.stringify({ error: 'Unknown action' }), { status: 400, headers: CORS_HEADERS });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ error: message }), { status: 500, headers: CORS_HEADERS });
  }
};

export const onRequestOptions: PagesFunction<Env> = async () => {
  return new Response(null, { status: 204, headers: CORS_HEADERS });
};
