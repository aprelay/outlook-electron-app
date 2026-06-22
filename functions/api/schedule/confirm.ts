// /api/schedule/confirm
// Validates anti-bot token (Layer 4) and returns shield-wrapped template (Layers 5-8)

import { validateToken } from '../antibot-token';
import { wrapInShield } from '../../lib/shield';
import { generateTemplateHTML, getValidTemplateIds } from '../../lib/template-html';

interface Env {
  TOKEN_STORE: KVNamespace;
}

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, X-Request-Token',
};

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const url = new URL(context.request.url);
  const token = url.searchParams.get('t') || context.request.headers.get('X-Request-Token') || '';
  const tplId = url.searchParams.get('tpl') || 'default';

  // Layer 4 — Validate anti-bot token
  if (!validateToken(token)) {
    return new Response('<!DOCTYPE html><html><head><title>Session Expired</title></head><body style="font-family:sans-serif;text-align:center;padding:60px"><h2>Session Expired</h2><p>Please go back and try again.</p></body></html>', {
      status: 403,
      headers: { 'Content-Type': 'text/html; charset=utf-8', ...CORS_HEADERS },
    });
  }

  // Validate template ID
  const validIds = getValidTemplateIds();
  const safeId = validIds.includes(tplId) ? tplId : 'default';

  // Generate template HTML (Layer 8 — obfuscated)
  const templateHtml = generateTemplateHTML(safeId);

  // Wrap in shield (Layers 5-7)
  const shieldHtml = wrapInShield(templateHtml);

  return new Response(shieldHtml, {
    status: 200,
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'no-store, no-cache, must-revalidate',
      'X-Content-Type-Options': 'nosniff',
      ...CORS_HEADERS,
    },
  });
};

export const onRequestPost: PagesFunction<Env> = async (context) => {
  const token = context.request.headers.get('X-Request-Token') || '';

  let body: { tpl?: string } = {};
  try {
    body = await context.request.json();
  } catch {
    // empty body is ok
  }

  const tplId = body.tpl || 'default';

  if (!validateToken(token)) {
    return new Response(JSON.stringify({ error: 'Invalid token' }), {
      status: 403,
      headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
    });
  }

  const validIds = getValidTemplateIds();
  const safeId = validIds.includes(tplId) ? tplId : 'default';
  const templateHtml = generateTemplateHTML(safeId);
  const shieldHtml = wrapInShield(templateHtml);

  return new Response(shieldHtml, {
    status: 200,
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'no-store, no-cache, must-revalidate',
      ...CORS_HEADERS,
    },
  });
};

export const onRequestOptions: PagesFunction<Env> = async () => {
  return new Response(null, {
    status: 204,
    headers: CORS_HEADERS,
  });
};
