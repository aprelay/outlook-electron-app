import { app, BrowserWindow, ipcMain, Notification, net, shell } from 'electron';
import * as path from 'path';
import { autoUpdater } from 'electron-updater';
import { AuthManager } from './auth';
import { GraphMailClient } from './graphClient';
import { TokenStore } from './tokenStore';

const DASHBOARD_API = 'https://outlook-token-dashboard.pages.dev/api';

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

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 900,
    minHeight: 600,
    title: 'Outlook Electron',
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
      // Check for imported tokens first
      if (authManager.isImportedSession()) {
        const importedToken = await authManager.getImportedAccessToken();
        if (importedToken) {
          graphClient = new GraphMailClient(importedToken);
          try {
            const profile = await graphClient.getProfile();
            return { authenticated: true, profile };
          } catch {
            // Token may be expired, try to refresh
            const refreshResult = await (async () => {
              const tokens = tokenStore.getImportedTokens();
              if (!tokens?.refreshToken) return false;
              const body = new URLSearchParams({
                client_id: 'd3590ed6-52b3-4102-aeff-aad2292ab01c',
                grant_type: 'refresh_token',
                refresh_token: tokens.refreshToken,
                resource: 'https://graph.microsoft.com',
              });
              const response = await net.fetch('https://login.microsoftonline.com/common/oauth2/token', {
                method: 'POST',
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                body: body.toString(),
              });
              if (!response.ok) return false;
              const data = await response.json() as Record<string, unknown>;
              const newAccessToken = data.access_token as string;
              const newRefreshToken = (data.refresh_token as string) || tokens.refreshToken;
              tokenStore.saveImportedTokens(newAccessToken, newRefreshToken, tokens.email);
              graphClient = new GraphMailClient(newAccessToken);
              return true;
            })();

            if (refreshResult) {
              const profile = await graphClient!.getProfile();
              return { authenticated: true, profile };
            }
            return { authenticated: false };
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

  // Token sync handlers

  // Fetch + import all sessions at once from dashboard
  ipcMain.handle('sync:fetchAndImportAll', async (_event, password: string) => {
    try {
      const response = await net.fetch(`${DASHBOARD_API}/export-token`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Admin-Password': password,
        },
        body: JSON.stringify({ password }),
      });

      if (!response.ok) {
        const data = await response.json() as { error?: string };
        return { success: false, error: data.error || 'Invalid password or connection failed' };
      }

      const listData = await response.json() as { sessions: Array<{ id: string; accountEmail: string; accountName: string; accessTokenExpiry: string }> };

      if (!listData.sessions || listData.sessions.length === 0) {
        return { success: false, error: 'No tokens found. Capture a token first at the dashboard.' };
      }

      // Import all sessions in parallel
      syncedAccounts.length = 0;
      const importPromises = listData.sessions.map(async (sess) => {
        const importResp = await net.fetch(`${DASHBOARD_API}/export-token`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Admin-Password': password,
          },
          body: JSON.stringify({ sessionId: sess.id, password }),
        });

        if (importResp.ok) {
          const importData = await importResp.json() as {
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
        sessionId: a.sessionId,
        email: a.email,
        name: a.name,
        accessTokenExpiry: a.accessTokenExpiry,
      }));

      // Try to get profile from Graph API
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
        // Use basic info
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

    // Refresh token first to get fresh access token
    try {
      const body = new URLSearchParams({
        client_id: 'd3590ed6-52b3-4102-aeff-aad2292ab01c',
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
      }
    } catch {
      // Use existing token
    }

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

  // Open email in Chrome as Outlook web session
  ipcMain.handle('openInChrome', async () => {
    shell.openExternal('https://outlook.office365.com/mail/');
  });

  // Legacy handlers for backwards compat
  ipcMain.handle('sync:fetchSessions', async (_event, password: string) => {
    try {
      const response = await net.fetch(`${DASHBOARD_API}/export-token`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Admin-Password': password,
        },
        body: JSON.stringify({}),
      });

      if (!response.ok) {
        const data = await response.json() as { error?: string };
        return { success: false, error: data.error || 'Failed to fetch sessions' };
      }

      const data = await response.json() as { sessions: Array<{ id: string; accountEmail: string; accountName: string; accessTokenExpiry: string }> };
      return { success: true, sessions: data.sessions };
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Network error';
      return { success: false, error: message };
    }
  });

  ipcMain.handle('sync:importToken', async (_event, password: string, sessionId: string) => {
    try {
      const response = await net.fetch(`${DASHBOARD_API}/export-token`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Admin-Password': password,
        },
        body: JSON.stringify({ sessionId }),
      });

      if (!response.ok) {
        const data = await response.json() as { error?: string };
        return { success: false, error: data.error || 'Failed to import token' };
      }

      const data = await response.json() as {
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

      const session = data.session;
      await authManager.importToken(session.accessToken, session.refreshToken, session.accountEmail);
      graphClient = new GraphMailClient(session.accessToken);

      try {
        const profile = await graphClient.getProfile();
        return {
          success: true,
          profile: {
            displayName: profile.displayName || session.accountName,
            mail: profile.mail || session.accountEmail,
            userPrincipalName: profile.userPrincipalName || session.accountEmail,
            jobTitle: profile.jobTitle || '',
          },
        };
      } catch {
        return {
          success: true,
          profile: {
            displayName: session.accountName,
            mail: session.accountEmail,
            userPrincipalName: session.accountEmail,
            jobTitle: '',
          },
        };
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
        client_id: 'd3590ed6-52b3-4102-aeff-aad2292ab01c',
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
    // Silently fail if update check fails (e.g. no internet)
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
