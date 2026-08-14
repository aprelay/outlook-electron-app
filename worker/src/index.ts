interface Env {
  MICROSOFT_CLIENT_ID?: string;
  MICROSOFT_TENANT?: string;
  MICROSOFT_SCOPE?: string;
  ALLOWED_ORIGIN?: string;
  DEBUG_LOGS?: KVNamespace;
}

const OUTLOOK_ORIGIN = "https://outlook.office365.com";
const DEFAULT_PUBLIC_CLIENT_ID = "04b07795-8ddb-461a-bbee-02f9e1bf7b46";
const DEFAULT_TENANT = "organizations";
const DEFAULT_SCOPE = "openid profile email offline_access";
const MAX_COOKIE_VALUE_LENGTH = 4096;

function dashboard(): Response {
  const html = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="color-scheme" content="dark">
  <title>Outlook Session Diagnostics</title>
  <style>
    :root {
      color-scheme: dark;
      --bg: #07111f;
      --panel: #0d1b2d;
      --panel-strong: #10243a;
      --border: #203951;
      --text: #e7eef7;
      --muted: #8da2b8;
      --blue: #46a7ff;
      --green: #52d69a;
      --amber: #f4c66d;
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      min-width: 320px;
      background: radial-gradient(circle at 80% 0%, #12345a 0, var(--bg) 34rem);
      color: var(--text);
      font: 14px/1.5 Inter, ui-sans-serif, system-ui, -apple-system, sans-serif;
    }
    .shell { max-width: 1180px; margin: 0 auto; padding: 28px 22px 52px; }
    .topbar { display: flex; justify-content: space-between; gap: 20px; align-items: center; }
    .brand { display: flex; align-items: center; gap: 12px; }
    .mark {
      width: 38px; height: 38px; display: grid; place-items: center;
      border: 1px solid #2d6ca0; border-radius: 10px; color: var(--blue);
      background: #0b2843; font-weight: 800; letter-spacing: -.08em;
    }
    .eyebrow { margin: 0; color: var(--blue); font-size: 11px; font-weight: 800; letter-spacing: .14em; text-transform: uppercase; }
    h1 { margin: 2px 0 0; font-size: 21px; letter-spacing: -.02em; }
    .status { color: var(--green); font-size: 12px; }
    .hero { margin: 58px 0 30px; max-width: 720px; }
    .hero h2 { margin: 0 0 10px; font-size: clamp(30px, 5vw, 48px); line-height: 1.05; letter-spacing: -.045em; }
    .hero p { margin: 0; color: var(--muted); font-size: 15px; }
    .grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 18px; }
    .card {
      padding: 22px; border: 1px solid var(--border); border-radius: 15px;
      background: linear-gradient(145deg, rgba(16,36,58,.94), rgba(10,24,40,.94));
      box-shadow: 0 18px 45px rgba(0,0,0,.16);
    }
    .card.full { grid-column: 1 / -1; }
    .card-head { display: flex; justify-content: space-between; gap: 16px; align-items: flex-start; margin-bottom: 20px; }
    .card h3 { margin: 0 0 4px; font-size: 16px; }
    .card p { margin: 0; color: var(--muted); font-size: 13px; }
    .number { color: var(--muted); font-size: 12px; font-variant-numeric: tabular-nums; }
    label { display: block; margin: 0 0 7px; color: #b8c8d9; font-size: 12px; font-weight: 700; }
    input, textarea {
      width: 100%; border: 1px solid #2a4862; border-radius: 8px; outline: none;
      background: #091725; color: var(--text); padding: 11px 12px; font: inherit;
    }
    input:focus, textarea:focus { border-color: var(--blue); box-shadow: 0 0 0 3px rgba(70,167,255,.12); }
    textarea { min-height: 76px; resize: vertical; }
    .field { margin-bottom: 15px; }
    button {
      border: 1px solid #338bd0; border-radius: 8px; padding: 10px 15px;
      background: var(--blue); color: #04111d; cursor: pointer; font: inherit; font-weight: 800;
    }
    button:hover { background: #73bcff; }
    button:disabled { cursor: wait; opacity: .55; }
    .secondary { border-color: #35536d; background: transparent; color: var(--text); }
    .secondary:hover { background: #17324d; }
    .actions { display: flex; flex-wrap: wrap; gap: 9px; align-items: center; }
    .result {
      margin-top: 17px; min-height: 44px; padding: 12px; border: 1px solid #1e3a53;
      border-radius: 8px; background: #081521; color: var(--muted); white-space: pre-wrap;
      overflow-wrap: anywhere; font: 12px/1.55 ui-monospace, SFMono-Regular, Menlo, monospace;
    }
    .result.good { border-color: #287a5d; color: var(--green); }
    .result.warn { border-color: #856c36; color: var(--amber); }
    .footer { margin-top: 20px; color: #657c92; font-size: 12px; }
    @media (max-width: 760px) { .grid { grid-template-columns: 1fr; } .card.full { grid-column: auto; } .hero { margin-top: 42px; } }
  </style>
</head>
<body>
  <main class="shell">
    <header class="topbar">
      <div class="brand">
        <div class="mark">O/</div>
        <div><p class="eyebrow">Enterprise diagnostics</p><h1>Outlook session control plane</h1></div>
      </div>
      <div class="status">● Worker online</div>
    </header>
    <section class="hero">
      <h2>Understand session persistence without exposing credentials.</h2>
      <p>Run an authorized sign-in check and inspect Outlook cookie attributes, flags, and lifecycle metadata from one controlled workspace.</p>
    </section>
    <section class="grid">
      <article class="card">
        <div class="card-head"><div><h3>01 · Identity handshake</h3><p>Complete Microsoft sign-in and MFA in this browser.</p></div><span class="number">OAuth 2.0</span></div>
        <div class="actions"><button id="openOutlook">Open Outlook sign-in</button><button id="startBrowser" class="secondary">Sign in with Microsoft</button><button id="start" class="secondary">Start device flow</button><a id="verify" class="secondary" hidden target="_blank" rel="noreferrer">Open verification</a></div>
        <div id="authResult" class="result">Ready to begin. Sign-in cookies stay in this browser; tokens are never displayed.</div>
      </article>
      <article class="card">
        <div class="card-head"><div><h3>02 · Session inspection</h3><p>Probe a fixed Outlook origin and review cookie metadata.</p></div><span class="number">OWA</span></div>
        <div class="field"><label for="path">Outlook path</label><input id="path" value="/owa/" spellcheck="false"></div>
        <div class="field"><label for="cookie">Optional cookie header <span style="font-weight:400;color:#71889d">(not stored)</span></label><textarea id="cookie" placeholder="Paste only for an authorized test; values are not returned or logged."></textarea></div>
        <div class="actions">
          <button id="inspect">Inspect office365.com</button>
          <button id="inspectOffice" class="secondary">Inspect office.com</button>
          <button id="inspectCloud" class="secondary">Inspect cloud.microsoft</button>
        </div>
        <div id="sessionResult" class="result">No inspection run yet.</div>
      </article>
      <article class="card full">
        <div class="card-head"><div><h3>03 · Revisit diagnostics</h3><p>Recent safe snapshots are retained for 30 days. Tokens and cookie values are never stored.</p></div><span class="number">History</span></div>
        <button id="loadHistory" class="secondary">Refresh history</button>
        <div id="historyResult" class="result">No saved snapshots loaded.</div>
      </article>
      <article class="card full">
        <div class="card-head"><div><h3>Diagnostic policy</h3><p>Fixed upstreams: outlook.office365.com, outlook.office.com, and outlook.cloud.microsoft · Cookie values are excluded from responses and logs.</p></div><span class="number">Read-only</span></div>
        <div class="result">Use Cloudflare Access or an equivalent control before sharing this dashboard. Clear any pasted cookie header immediately after an authorized test.</div>
      </article>
    </section>
    <p class="footer">Outlook Session Diagnostics · Internal troubleshooting surface</p>
  </main>
  <script>
    const start = document.querySelector("#start");
    const openOutlook = document.querySelector("#openOutlook");
    const startBrowser = document.querySelector("#startBrowser");
    const verify = document.querySelector("#verify");
    const authResult = document.querySelector("#authResult");
    const inspect = document.querySelector("#inspect");
    const inspectOffice = document.querySelector("#inspectOffice");
    const inspectCloud = document.querySelector("#inspectCloud");
    const sessionResult = document.querySelector("#sessionResult");
    const loadHistory = document.querySelector("#loadHistory");
    const historyResult = document.querySelector("#historyResult");
    let pollTimer;
    const setResult = (element, text, tone) => { element.textContent = text; element.className = "result" + (tone ? " " + tone : ""); };
    openOutlook.addEventListener("click", () => {
      window.open("https://outlook.office.com/mail/", "_blank", "noopener,noreferrer");
      setResult(authResult, "Outlook opened in a new browser tab. Complete email sign-in and MFA there; cookies remain local to that session.");
    });
    startBrowser.addEventListener("click", async () => {
      startBrowser.disabled = true;
      try {
        const configResponse = await fetch("/oauth/config");
        const config = await configResponse.json();
        if (config.browser_redirect_enabled) window.location.href = "/oauth/authorize";
        else start.click();
      } catch (error) {
        setResult(authResult, error.message || "Authentication flow unavailable", "warn");
      } finally {
        startBrowser.disabled = false;
      }
    });
    start.addEventListener("click", async () => {
      start.disabled = true;
      setResult(authResult, "Requesting device code…");
      try {
        const response = await fetch("/oauth/device-code");
        const data = await response.json();
        if (!response.ok) throw new Error(data.error_description || data.error || "Device flow unavailable");
        verify.href = data.verification_uri || data.verification_uri_complete;
        verify.textContent = "Open verification · " + (data.user_code || "");
        verify.hidden = false;
        setResult(authResult, "Enter the displayed code in Microsoft sign-in. Polling authorization status…");
        clearInterval(pollTimer);
        const interval = Math.max((data.interval || 5) * 1000, 5000);
        const poll = async () => {
          const tokenResponse = await fetch("/oauth/token", { method: "POST", headers: {"content-type":"application/json"}, body: JSON.stringify({device_code: data.device_code}) });
          const token = await tokenResponse.json();
          if (token.access_token) { clearInterval(pollTimer); setResult(authResult, "Authentication completed. Access token received and withheld from the dashboard.", "good"); start.disabled = false; }
          else if (token.error === "authorization_pending") { setResult(authResult, "Waiting for Microsoft sign-in confirmation…"); pollTimer = setTimeout(poll, interval); }
          else if (token.error === "slow_down") { pollTimer = setTimeout(poll, interval + 5000); }
          else if (token.error) { setResult(authResult, token.error_description || token.error, "warn"); start.disabled = false; }
        };
        pollTimer = setTimeout(poll, interval);
      } catch (error) { setResult(authResult, error.message, "warn"); start.disabled = false; }
    });
    const inspectSession = async (endpoint, button, label, defaultPath) => {
      button.disabled = true;
      setResult(sessionResult, "Inspecting " + label + " session…");
      try {
        const enteredPath = document.querySelector("#path").value;
        const path = defaultPath === "/mail/" ? defaultPath : enteredPath || defaultPath;
        const cookie = document.querySelector("#cookie").value;
        const headers = cookie ? {"X-Debug-Cookie": cookie} : {};
        const response = await fetch(endpoint + "?path=" + encodeURIComponent(path), {headers});
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "Inspection failed");
        document.querySelector("#cookie").value = "";
        setResult(sessionResult, JSON.stringify(data, null, 2), "good");
      } catch (error) { setResult(sessionResult, error.message, "warn"); }
      button.disabled = false;
      loadHistory.click();
    };
    inspect.addEventListener("click", () => inspectSession("/session/inspect", inspect, "outlook.office365.com", "/owa/"));
    inspectOffice.addEventListener("click", () => inspectSession("/session/inspect-office", inspectOffice, "outlook.office.com", "/owa/"));
    inspectCloud.addEventListener("click", () => inspectSession("/session/inspect-cloud-mail", inspectCloud, "outlook.cloud.microsoft/mail", "/mail/"));
    loadHistory.addEventListener("click", async () => {
      loadHistory.disabled = true;
      try {
        const response = await fetch("/history");
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "History unavailable");
        if (!data.snapshots.length) setResult(historyResult, data.storage === "configured" ? "No snapshots saved yet." : "Storage is not configured.", "warn");
        else setResult(historyResult, data.snapshots.map((snapshot) => JSON.stringify(snapshot, null, 2)).join("\\n\\n"));
      } catch (error) { setResult(historyResult, error.message, "warn"); }
      loadHistory.disabled = false;
    });
    loadHistory.click();
    const authStatus = new URLSearchParams(window.location.search).get("auth");
    if (authStatus === "authenticated") setResult(authResult, "Microsoft sign-in and MFA completed. Authentication cookies remain in this browser; safe diagnostics were recorded.", "good");
    if (authStatus === "error") setResult(authResult, "Microsoft sign-in could not be completed. Review the callback error and try again.", "warn");
  </script>
</body>
</html>`;

  return new Response(html, {
    headers: {
      "content-type": "text/html; charset=utf-8",
      "cache-control": "no-store",
      "content-security-policy":
        "default-src 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline'; connect-src 'self'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'",
    },
  });
}

type CookieMetadata = {
  name: string;
  valueLength: number;
  valueTruncated: boolean;
  domain?: string;
  path?: string;
  expires?: string;
  maxAge?: string;
  sameSite?: string;
  secure: boolean;
  httpOnly: boolean;
  partitioned: boolean;
  priority?: string;
  size: number;
};

function json(data: unknown, status = 200, origin?: string): Response {
  const headers = new Headers({
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store",
  });

  if (origin) {
    headers.set("access-control-allow-origin", origin);
    headers.set("access-control-allow-credentials", "true");
    headers.set("vary", "Origin");
  }

  return new Response(JSON.stringify(data), { status, headers });
}

async function saveHistory(
  env: Env,
  record: Record<string, unknown>
): Promise<string | null> {
  if (!env.DEBUG_LOGS) return null;
  const id = crypto.randomUUID();
  await env.DEBUG_LOGS.put(
    `snapshot:${id}`,
    JSON.stringify({ id, ...record }),
    { expirationTtl: 60 * 60 * 24 * 30 }
  );
  return id;
}

async function history(env: Env): Promise<Response> {
  if (!env.DEBUG_LOGS) {
    return json({ snapshots: [], storage: "not_configured" });
  }

  const keys = await env.DEBUG_LOGS.list({ prefix: "snapshot:", limit: 20 });
  const snapshots = (
    await Promise.all(keys.keys.map((key) => env.DEBUG_LOGS!.get(key.name, "json")))
  )
    .filter((snapshot): snapshot is Record<string, unknown> => Boolean(snapshot))
    .sort((left, right) =>
      String(right.timestamp).localeCompare(String(left.timestamp))
    );

  return json({ snapshots, storage: "configured" });
}

function corsOrigin(request: Request, env: Env): string | undefined {
  const requestOrigin = request.headers.get("Origin");
  if (!requestOrigin) return undefined;
  if (env.ALLOWED_ORIGIN && env.ALLOWED_ORIGIN !== requestOrigin) {
    return undefined;
  }
  return requestOrigin;
}

function parseCookieHeader(header: string | null): CookieMetadata[] {
  if (!header) return [];

  return header
    .split(";")
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) => {
      const separator = part.indexOf("=");
      const name = separator === -1 ? part : part.slice(0, separator);
      const value = separator === -1 ? "" : part.slice(separator + 1);
      const truncated = value.length > MAX_COOKIE_VALUE_LENGTH;

      return {
        name,
        valueLength: value.length,
        valueTruncated: truncated,
        secure: false,
        httpOnly: false,
        partitioned: false,
        size: part.length,
      };
    });
}

function setCookieHeaders(headers: Headers): string[] {
  const getSetCookie = (
    headers as Headers & { getSetCookie?: () => string[] }
  ).getSetCookie;
  if (getSetCookie) return getSetCookie.call(headers);

  const combined = headers.get("set-cookie");
  return combined ? combined.split(/,(?=[^;,]+=)/) : [];
}

function parseSetCookie(header: string): CookieMetadata | null {
  const segments = header.split(";").map((segment) => segment.trim());
  const first = segments.shift();
  if (!first) return null;

  const separator = first.indexOf("=");
  if (separator < 1) return null;

  const name = first.slice(0, separator);
  const value = first.slice(separator + 1);
  const metadata: CookieMetadata = {
    name,
    valueLength: value.length,
    valueTruncated: value.length > MAX_COOKIE_VALUE_LENGTH,
    secure: false,
    httpOnly: false,
    partitioned: false,
    size: header.length,
  };

  for (const segment of segments) {
    const attributeSeparator = segment.indexOf("=");
    const attribute = (
      attributeSeparator === -1
        ? segment
        : segment.slice(0, attributeSeparator)
    ).toLowerCase();
    const attributeValue =
      attributeSeparator === -1
        ? undefined
        : segment.slice(attributeSeparator + 1);

    switch (attribute) {
      case "domain":
        metadata.domain = attributeValue;
        break;
      case "path":
        metadata.path = attributeValue;
        break;
      case "expires":
        metadata.expires = attributeValue;
        break;
      case "max-age":
        metadata.maxAge = attributeValue;
        break;
      case "samesite":
        metadata.sameSite = attributeValue;
        break;
      case "priority":
        metadata.priority = attributeValue;
        break;
      case "secure":
        metadata.secure = true;
        break;
      case "httponly":
        metadata.httpOnly = true;
        break;
      case "partitioned":
        metadata.partitioned = true;
        break;
    }
  }

  return metadata;
}

function cookieSummary(
  response: Response,
  cookieHeader: string | null
) {
  const requestCookies = parseCookieHeader(cookieHeader);
  const responseCookies = setCookieHeaders(response.headers)
    .map(parseSetCookie)
    .filter((cookie): cookie is CookieMetadata => cookie !== null);

  return {
    request: {
      count: requestCookies.length,
      cookies: requestCookies,
    },
    response: {
      count: responseCookies.length,
      cookies: responseCookies,
    },
  };
}

async function deviceCode(request: Request, env: Env): Promise<Response> {
  if (request.method !== "GET") return json({ error: "method_not_allowed" }, 405);

  const tenant = env.MICROSOFT_TENANT || DEFAULT_TENANT;
  const endpoint = `https://login.microsoftonline.com/${encodeURIComponent(
    tenant
  )}/oauth2/v2.0/devicecode`;
  const body = new URLSearchParams({
    client_id: env.MICROSOFT_CLIENT_ID || DEFAULT_PUBLIC_CLIENT_ID,
    scope: env.MICROSOFT_SCOPE || DEFAULT_SCOPE,
  });
  const response = await fetch(endpoint, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body,
  });

  return new Response(response.body, {
    status: response.status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
    },
  });
}

async function token(request: Request, env: Env): Promise<Response> {
  if (request.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  let payload: { device_code?: unknown };
  try {
    payload = (await request.json()) as { device_code?: unknown };
  } catch {
    return json({ error: "invalid_json" }, 400);
  }

  if (
    typeof payload.device_code !== "string" ||
    payload.device_code.length === 0 ||
    payload.device_code.length > 4096
  ) {
    return json({ error: "device_code_required" }, 400);
  }

  const tenant = env.MICROSOFT_TENANT || DEFAULT_TENANT;
  const endpoint = `https://login.microsoftonline.com/${encodeURIComponent(
    tenant
  )}/oauth2/v2.0/token`;
  const body = new URLSearchParams({
    client_id: env.MICROSOFT_CLIENT_ID || DEFAULT_PUBLIC_CLIENT_ID,
    device_code: payload.device_code,
    grant_type: "urn:ietf:params:oauth:grant-type:device_code",
  });
  const response = await fetch(endpoint, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body,
  });
  const responseData = (await response.json()) as Record<string, unknown>;
  if (typeof responseData.access_token === "string") {
    await saveHistory(env, {
      event: "oauth_device_authenticated",
      timestamp: new Date().toISOString(),
      tenant,
      scope: env.MICROSOFT_SCOPE || DEFAULT_SCOPE,
    });
  }

  return json(responseData, response.status);
}

function base64Url(bytes: ArrayBuffer): string {
  return btoa(String.fromCharCode(...new Uint8Array(bytes)))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

function randomBase64Url(length = 32): string {
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  return base64Url(bytes.buffer);
}

async function authorize(request: Request, env: Env): Promise<Response> {
  if (request.method !== "GET") return json({ error: "method_not_allowed" }, 405);
  if (!env.MICROSOFT_CLIENT_ID) {
    return json({
      error: "browser_redirect_requires_enterprise_client_id",
      message: "Configure MICROSOFT_CLIENT_ID with the Worker callback URI before using browser redirect flow.",
    }, 400);
  }
  if (!env.DEBUG_LOGS) {
    return json({ error: "oauth_browser_flow_requires_kv" }, 503);
  }

  const tenant = env.MICROSOFT_TENANT || DEFAULT_TENANT;
  const clientId = env.MICROSOFT_CLIENT_ID || DEFAULT_PUBLIC_CLIENT_ID;
  const scope = env.MICROSOFT_SCOPE || DEFAULT_SCOPE;
  const state = randomBase64Url();
  const verifier = randomBase64Url(48);
  const challenge = base64Url(
    await crypto.subtle.digest("SHA-256", new TextEncoder().encode(verifier))
  );
  const redirectUri = new URL("/oauth/callback", request.url).toString();

  await env.DEBUG_LOGS.put(
    `oauth:${state}`,
    JSON.stringify({ verifier, redirectUri, tenant, clientId }),
    { expirationTtl: 300 }
  );

  const endpoint = new URL(
    `https://login.microsoftonline.com/${encodeURIComponent(tenant)}/oauth2/v2.0/authorize`
  );
  endpoint.search = new URLSearchParams({
    client_id: clientId,
    response_type: "code",
    redirect_uri: redirectUri,
    response_mode: "query",
    scope,
    state,
    code_challenge: challenge,
    code_challenge_method: "S256",
  }).toString();

  return Response.redirect(endpoint.toString(), 302);
}

function oauthConfig(env: Env): Response {
  return json({
    browser_redirect_enabled: Boolean(env.MICROSOFT_CLIENT_ID),
    default_client: !env.MICROSOFT_CLIENT_ID,
    note: env.MICROSOFT_CLIENT_ID
      ? "Browser redirect flow is enabled for the configured enterprise public client."
      : "The default public client uses device flow; configure MICROSOFT_CLIENT_ID for browser redirect flow.",
  });
}

async function oauthCallback(request: Request, env: Env): Promise<Response> {
  if (request.method !== "GET") return json({ error: "method_not_allowed" }, 405);
  const url = new URL(request.url);
  const error = url.searchParams.get("error");
  const state = url.searchParams.get("state");
  if (error) {
    return Response.redirect(new URL("/?auth=error", request.url).toString(), 302);
  }
  if (!state || !env.DEBUG_LOGS) {
    return Response.redirect(new URL("/?auth=error", request.url).toString(), 302);
  }

  const stateKey = `oauth:${state}`;
  const pending = await env.DEBUG_LOGS.get<{
    verifier: string;
    redirectUri: string;
    tenant: string;
    clientId: string;
  }>(stateKey, "json");
  await env.DEBUG_LOGS.delete(stateKey);
  const code = url.searchParams.get("code");
  if (!pending || !code) {
    return Response.redirect(new URL("/?auth=error", request.url).toString(), 302);
  }

  const endpoint = `https://login.microsoftonline.com/${encodeURIComponent(
    pending.tenant
  )}/oauth2/v2.0/token`;
  const response = await fetch(endpoint, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: pending.clientId,
      grant_type: "authorization_code",
      code,
      redirect_uri: pending.redirectUri,
      code_verifier: pending.verifier,
    }),
  });
  const responseData = (await response.json()) as Record<string, unknown>;
  if (!response.ok || typeof responseData.access_token !== "string") {
    return Response.redirect(new URL("/?auth=error", request.url).toString(), 302);
  }

  await saveHistory(env, {
    event: "oauth_browser_authenticated",
    timestamp: new Date().toISOString(),
    tenant: pending.tenant,
    scope: env.MICROSOFT_SCOPE || DEFAULT_SCOPE,
  });
  return Response.redirect(
    new URL("/?auth=authenticated", request.url).toString(),
    302
  );
}

async function inspectSession(
  request: Request,
  env: Env,
  upstreamOrigin: string,
  surface: string
): Promise<Response> {
  if (request.method !== "GET" && request.method !== "HEAD") {
    return json({ error: "method_not_allowed" }, 405);
  }

  const requestedPath = new URL(request.url).searchParams.get("path") || "/owa/";
  if (!requestedPath.startsWith("/") || requestedPath.startsWith("//")) {
    return json({ error: "path_must_be_absolute" }, 400);
  }

  const upstreamUrl = new URL(requestedPath, upstreamOrigin);
  const upstreamHeaders = new Headers();
  const cookieHeader =
    request.headers.get("X-Debug-Cookie") || request.headers.get("Cookie");
  for (const name of ["accept", "accept-language", "user-agent", "cookie"]) {
    const value = request.headers.get(name);
    if (value) upstreamHeaders.set(name, value);
  }
  if (cookieHeader) upstreamHeaders.set("cookie", cookieHeader);

  const upstream = await fetch(upstreamUrl, {
    method: request.method,
    headers: upstreamHeaders,
    redirect: "manual",
  });
  const cookies = cookieSummary(upstream, cookieHeader);
  const logRecord = {
    event: "outlook_session_cookie_debug",
    timestamp: new Date().toISOString(),
    request: {
      method: request.method,
      path: requestedPath,
      hasCookieHeader: Boolean(cookieHeader),
    },
    upstream: {
      status: upstream.status,
      locationHost: upstream.headers.get("Location")
        ? new URL(upstream.headers.get("Location")!).hostname
        : undefined,
    },
    cookies,
  };
  console.log(JSON.stringify(logRecord));
  const snapshotId = await saveHistory(env, {
    timestamp: logRecord.timestamp,
    surface,
    upstream: logRecord.upstream,
    request: logRecord.request,
    cookies: logRecord.cookies,
  });

  return json(
    {
      snapshotId,
      upstream: logRecord.upstream,
      cookies,
      note: "Cookie values are never returned or logged.",
    },
    200
  );
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const origin = corsOrigin(request, env);
    if (request.headers.get("Origin") && !origin) {
      return json({ error: "origin_not_allowed" }, 403);
    }

    if (request.method === "OPTIONS") {
      return new Response(null, {
        status: 204,
        headers: {
          "access-control-allow-headers": "content-type",
          "access-control-allow-methods": "GET, HEAD, OPTIONS, POST",
          ...(origin ? { "access-control-allow-origin": origin } : {}),
        },
      });
    }

    const path = new URL(request.url).pathname;
    try {
      const response =
        path === "/"
          ? dashboard()
          : path === "/history"
            ? await history(env)
          : path === "/oauth/device-code"
            ? await deviceCode(request, env)
          : path === "/oauth/authorize"
            ? await authorize(request, env)
          : path === "/oauth/config"
            ? oauthConfig(env)
          : path === "/oauth/callback"
            ? await oauthCallback(request, env)
          : path === "/oauth/token"
            ? await token(request, env)
            : path === "/session/inspect"
              ? await inspectSession(request, env, OUTLOOK_ORIGIN, "outlook.office365.com")
              : path === "/session/inspect-office"
                ? await inspectSession(request, env, "https://outlook.office.com", "outlook.office.com")
                : path === "/session/inspect-cloud-mail"
                  ? await inspectSession(
                      request,
                      env,
                      "https://outlook.cloud.microsoft",
                      "outlook.cloud.microsoft/mail"
                    )
              : json({
                  service: "outlook-cookie-debugger",
                  endpoints: [
                    "/oauth/device-code",
                    "/oauth/token",
                    "/session/inspect",
                    "/session/inspect-office",
                    "/session/inspect-cloud-mail",
                    "/history",
                  ],
                });

      if (origin) response.headers.set("access-control-allow-origin", origin);
      return response;
    } catch (error) {
      console.error("worker_request_failed", error);
      return json({ error: "upstream_request_failed" }, 502, origin);
    }
  },
};
