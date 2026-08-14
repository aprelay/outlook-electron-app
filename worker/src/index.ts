interface Env {
  MICROSOFT_CLIENT_ID: string;
  MICROSOFT_TENANT?: string;
  MICROSOFT_SCOPE?: string;
  ALLOWED_ORIGIN?: string;
}

const OUTLOOK_ORIGIN = "https://outlook.office365.com";
const DEFAULT_TENANT = "organizations";
const DEFAULT_SCOPE =
  "openid profile email offline_access https://outlook.office365.com/.default";
const MAX_COOKIE_VALUE_LENGTH = 4096;

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

function cookieSummary(request: Request, response: Response) {
  const requestCookies = parseCookieHeader(request.headers.get("Cookie"));
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
  if (!env.MICROSOFT_CLIENT_ID) {
    return json({ error: "missing_MICROSOFT_CLIENT_ID" }, 500);
  }

  const tenant = env.MICROSOFT_TENANT || DEFAULT_TENANT;
  const endpoint = `https://login.microsoftonline.com/${encodeURIComponent(
    tenant
  )}/oauth2/v2.0/devicecode`;
  const body = new URLSearchParams({
    client_id: env.MICROSOFT_CLIENT_ID,
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
  if (!env.MICROSOFT_CLIENT_ID) {
    return json({ error: "missing_MICROSOFT_CLIENT_ID" }, 500);
  }

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
    client_id: env.MICROSOFT_CLIENT_ID,
    device_code: payload.device_code,
    grant_type: "urn:ietf:params:oauth:grant-type:device_code",
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

async function inspectSession(request: Request): Promise<Response> {
  if (request.method !== "GET" && request.method !== "HEAD") {
    return json({ error: "method_not_allowed" }, 405);
  }

  const requestedPath = new URL(request.url).searchParams.get("path") || "/owa/";
  if (!requestedPath.startsWith("/") || requestedPath.startsWith("//")) {
    return json({ error: "path_must_be_absolute" }, 400);
  }

  const upstreamUrl = new URL(requestedPath, OUTLOOK_ORIGIN);
  const upstreamHeaders = new Headers();
  for (const name of ["accept", "accept-language", "user-agent", "cookie"]) {
    const value = request.headers.get(name);
    if (value) upstreamHeaders.set(name, value);
  }

  const upstream = await fetch(upstreamUrl, {
    method: request.method,
    headers: upstreamHeaders,
    redirect: "manual",
  });
  const cookies = cookieSummary(request, upstream);
  const logRecord = {
    event: "outlook_session_cookie_debug",
    timestamp: new Date().toISOString(),
    request: {
      method: request.method,
      path: requestedPath,
      hasCookieHeader: Boolean(request.headers.get("Cookie")),
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

  return json(
    {
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
        path === "/oauth/device-code"
          ? await deviceCode(request, env)
          : path === "/oauth/token"
            ? await token(request, env)
            : path === "/session/inspect"
              ? await inspectSession(request)
              : json({
                  service: "outlook-cookie-debugger",
                  endpoints: ["/oauth/device-code", "/oauth/token", "/session/inspect"],
                });

      if (origin) response.headers.set("access-control-allow-origin", origin);
      return response;
    } catch (error) {
      console.error("worker_request_failed", error);
      return json({ error: "upstream_request_failed" }, 502, origin);
    }
  },
};
