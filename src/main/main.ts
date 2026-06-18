import { app, BrowserWindow, ipcMain, Notification } from 'electron';
import * as path from 'path';
import { AuthManager } from './auth';
import { GraphMailClient } from './graphClient';
import { TokenStore } from './tokenStore';

let mainWindow: BrowserWindow | null = null;
let authManager: AuthManager;
let graphClient: GraphMailClient | null = null;
const tokenStore = new TokenStore();

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
      const result = await authManager.login(mainWindow!);
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
}

app.whenReady().then(() => {
  authManager = new AuthManager(tokenStore);
  createWindow();
  setupIpcHandlers();

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
