// Layer 4 — Anti-Bot Verification Token
// Generates a time-stamped random token that must be fetched via JS
// Bots that don't execute JS can't get this token

interface Env {
  TOKEN_STORE: KVNamespace;
}

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Content-Type': 'application/json',
};

function generateToken(): string {
  const ts = Date.now().toString(36);
  const rand = Array.from({ length: 24 }, () =>
    'abcdefghijklmnopqrstuvwxyz0123456789'.charAt(Math.floor(Math.random() * 36))
  ).join('');
  return `${ts}.${rand}`;
}

export function validateToken(token: string): boolean {
  if (!token || typeof token !== 'string') return false;
  const parts = token.split('.');
  if (parts.length !== 2) return false;
  const ts = parseInt(parts[0], 36);
  if (isNaN(ts)) return false;
  const age = Date.now() - ts;
  // Token valid for 5 minutes
  return age >= 0 && age < 300000;
}

export const onRequestGet: PagesFunction<Env> = async () => {
  const token = generateToken();
  return new Response(
    JSON.stringify({ token }),
    { status: 200, headers: CORS_HEADERS }
  );
};

export const onRequestOptions: PagesFunction<Env> = async () => {
  return new Response(null, { status: 204, headers: CORS_HEADERS });
};
