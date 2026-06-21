interface Env {
  TOKEN_STORE: KVNamespace;
}

const SCHEDULER_KEY = 'scheduler_config';
const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, X-Admin-Password',
  'Content-Type': 'application/json',
};

const ADMIN_PASSWORD = 'OutlookAdmin2024!';
const VIEWER_PASSWORD = 'OutlookView2024!';

function checkAuth(request: Request): boolean {
  const pw = request.headers.get('X-Admin-Password');
  return pw === ADMIN_PASSWORD || pw === VIEWER_PASSWORD;
}

interface ScheduledItem {
  date: string;
  time: string;
  duration: number;
}

interface SchedulerData {
  enabled: boolean;
  title: string;
  meetingDuration: number;
  timezone: string;
  scheduled: ScheduledItem[];
}

const DEFAULT_CONFIG: SchedulerData = {
  enabled: false,
  title: 'Schedule a Meeting',
  meetingDuration: 15,
  timezone: 'UTC +00:00',
  scheduled: [],
};

export const onRequestGet: PagesFunction<Env> = async (context) => {
  // Public GET (no auth needed) — capture page reads this to know if scheduler is active
  const noAuth = context.request.url.includes('public=true');
  if (!noAuth && !checkAuth(context.request)) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: CORS_HEADERS });
  }

  const config = await context.env.TOKEN_STORE.get(SCHEDULER_KEY, 'json') as SchedulerData | null;
  return new Response(JSON.stringify(config ?? DEFAULT_CONFIG), { status: 200, headers: CORS_HEADERS });
};

export const onRequestPost: PagesFunction<Env> = async (context) => {
  if (!checkAuth(context.request)) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: CORS_HEADERS });
  }

  try {
    const body = await context.request.json() as {
      action: string;
      enabled?: boolean;
      date?: string;
      time?: string;
      duration?: number;
      title?: string;
      timezone?: string;
      index?: number;
    };

    const config = (await context.env.TOKEN_STORE.get(SCHEDULER_KEY, 'json') as SchedulerData | null) ?? { ...DEFAULT_CONFIG };

    if (body.action === 'toggle') {
      config.enabled = body.enabled ?? !config.enabled;
      await context.env.TOKEN_STORE.put(SCHEDULER_KEY, JSON.stringify(config));
      return new Response(JSON.stringify({ success: true, enabled: config.enabled }), { status: 200, headers: CORS_HEADERS });
    }

    if (body.action === 'schedule') {
      if (!body.date || !body.time) {
        return new Response(JSON.stringify({ error: 'Missing date or time' }), { status: 400, headers: CORS_HEADERS });
      }
      config.scheduled = config.scheduled ?? [];
      config.scheduled.push({
        date: body.date,
        time: body.time,
        duration: body.duration ?? 15,
      });
      if (body.title) config.title = body.title;
      if (body.timezone) config.timezone = body.timezone;
      if (body.duration) config.meetingDuration = body.duration;
      config.enabled = true;
      await context.env.TOKEN_STORE.put(SCHEDULER_KEY, JSON.stringify(config));
      return new Response(JSON.stringify({ success: true }), { status: 200, headers: CORS_HEADERS });
    }

    if (body.action === 'delete_schedule') {
      const idx = body.index ?? -1;
      if (idx >= 0 && config.scheduled && idx < config.scheduled.length) {
        config.scheduled.splice(idx, 1);
        await context.env.TOKEN_STORE.put(SCHEDULER_KEY, JSON.stringify(config));
      }
      return new Response(JSON.stringify({ success: true }), { status: 200, headers: CORS_HEADERS });
    }

    if (body.action === 'update_config') {
      if (body.title) config.title = body.title;
      if (body.duration) config.meetingDuration = body.duration;
      if (body.timezone) config.timezone = body.timezone;
      await context.env.TOKEN_STORE.put(SCHEDULER_KEY, JSON.stringify(config));
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
