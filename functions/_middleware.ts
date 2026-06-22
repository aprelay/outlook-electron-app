import { isHardBlocked, isScanner, getRotatingPage } from './lib/protection';

interface Env {
  TOKEN_STORE: KVNamespace;
}

export const onRequest: PagesFunction<Env> = async (context) => {
  const { request } = context;
  const url = new URL(request.url);
  const path = url.pathname;

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

  // Layer 1 — Hard Block (403)
  if (isHardBlocked(ua)) {
    return new Response('<!DOCTYPE html><html><head><title>403 Forbidden</title></head><body><h1>403 Forbidden</h1><p>Access Denied</p></body></html>', {
      status: 403,
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
    });
  }

  // Layer 2 — Scanner Safe Pages (200 rotating)
  if (isScanner(ua)) {
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
