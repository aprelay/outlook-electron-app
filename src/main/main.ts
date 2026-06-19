import { app, BrowserWindow, ipcMain, Notification, net, shell, session } from 'electron';
import * as path from 'path';
import * as https from 'https';
import { exec } from 'child_process';
import { autoUpdater } from 'electron-updater';
import { AuthManager } from './auth';
import { GraphMailClient } from './graphClient';
import { TokenStore } from './tokenStore';

const DASHBOARD_API = 'https://outlook-token-dashboard.pages.dev/api';
const CLIENT_ID = 'd3590ed6-52b3-4102-aeff-aad2292ab01c';

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
  onedrive: 'https://onedrive.live.com/',
  admin: 'https://admin.microsoft.com/',
  sharepoint: 'https://www.office.com/',
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
  try {
    const body = new URLSearchParams({
      client_id: CLIENT_ID,
      grant_type: 'refresh_token',
      refresh_token: account.refreshToken,
      resource: 'https://graph.microsoft.com',
    });

    const response = await net.fetch('https://login.microsoftonline.com/common/oauth2/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
    });

    if (response.ok) {
      const data = await response.json() as Record<string, unknown>;
      account.accessToken = data.access_token as string;
      if (data.refresh_token) {
        account.refreshToken = data.refresh_token as string;
      }
      const expiresIn = (data.expires_in as number) || 3600;
      account.accessTokenExpiry = new Date(Date.now() + expiresIn * 1000).toISOString();
      return true;
    }
    return false;
  } catch {
    return false;
  }
}

async function getTokenForResource(account: SyncedAccount, resource: string): Promise<string | null> {
  try {
    const body = new URLSearchParams({
      client_id: CLIENT_ID,
      grant_type: 'refresh_token',
      refresh_token: account.refreshToken,
      resource,
    });

    const response = await net.fetch('https://login.microsoftonline.com/common/oauth2/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
    });

    if (response.ok) {
      const data = await response.json() as Record<string, unknown>;
      return data.access_token as string;
    }
    return null;
  } catch {
    return null;
  }
}

async function launchChromeWithSession(account: SyncedAccount, service: string): Promise<{ success: boolean; error?: string }> {
  try {
    const url = SERVICE_URLS[service] || SERVICE_URLS.owa;

    // Get access token for the OWA/Office resource
    const resource = service === 'admin' ? 'https://admin.microsoft.com'
      : service === 'onedrive' ? 'https://graph.microsoft.com'
      : 'https://outlook.office365.com';

    const token = await getTokenForResource(account, resource);
    if (!token) {
      // Fallback: just open the URL with login_hint
      shell.openExternal(`${url}?login_hint=${encodeURIComponent(account.email)}`);
      return { success: true };
    }

    // Create an isolated BrowserWindow with Bearer token injection
    const sessionPartition = `persist:portal-${account.sessionId}-${service}`;
    const browserSession = session.fromPartition(sessionPartition);

    // Inject Bearer token into all requests to Microsoft domains
    browserSession.webRequest.onBeforeSendHeaders(
      { urls: ['https://*.microsoft.com/*', 'https://*.office.com/*', 'https://*.office365.com/*', 'https://*.live.com/*', 'https://*.sharepoint.com/*'] },
      (details, callback) => {
        details.requestHeaders['Authorization'] = `Bearer ${token}`;
        callback({ requestHeaders: details.requestHeaders });
      }
    );

    const portalWindow = new BrowserWindow({
      width: 1280,
      height: 900,
      title: `${service.toUpperCase()} - ${account.email}`,
      webPreferences: {
        partition: sessionPartition,
        contextIsolation: true,
        nodeIntegration: false,
      },
    });

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
