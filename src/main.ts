import { app, BrowserWindow, ipcMain, Menu, shell, session } from 'electron';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { MicrosoftAccountManager } from './auth';
import { PortalConnectionManager } from './portal';

const OUTLOOK_URL = 'https://outlook.office.com/mail/';
const ADMIN_CENTER_URL = 'https://admin.microsoft.com/';
const OUTLOOK_PARTITION = 'persist:outlook';
const AUTH_COOKIE_PATTERN =
  /ESTSAUTH|SignInStateCookie|RPSSecAuth|WLSSC|OHP|OH\.|MSPAuth|MUID/i;

type BrowserSessionStatus = {
  signedIn: boolean;
  cookieCount: number;
  domains: string[];
  updatedAt: string;
};

async function getOutlookSessionStatus(): Promise<BrowserSessionStatus> {
  const outlookSession = session.fromPartition(OUTLOOK_PARTITION);
  const cookies = await outlookSession.cookies.get({});
  const domains = Array.from(
    new Set(cookies.map((cookie) => cookie.domain?.replace(/^\./, '') ?? '')),
  ).filter(Boolean);
  return {
    signedIn: cookies.some((cookie) => AUTH_COOKIE_PATTERN.test(cookie.name)),
    cookieCount: cookies.length,
    domains,
    updatedAt: new Date().toISOString(),
  };
}

async function clearOutlookSession(): Promise<BrowserSessionStatus> {
  const outlookSession = session.fromPartition(OUTLOOK_PARTITION);
  await outlookSession.clearStorageData();
  return getOutlookSessionStatus();
}
const TRUSTED_HOSTS = [
  'microsoft.com',
  'microsoftonline.com',
  'office.com',
  'office365.com',
  'outlook.com',
  'live.com',
];

let portalWindow: BrowserWindow | null = null;
let outlookWindow: BrowserWindow | null = null;
let accountWindow: BrowserWindow | null = null;
let accountManager: MicrosoftAccountManager | null = null;
let portalManager: PortalConnectionManager | null = null;

function isTrustedUrl(rawUrl: string): boolean {
  try {
    const url = new URL(rawUrl);
    if (url.protocol !== 'https:') {
      return false;
    }
    return TRUSTED_HOSTS.some(
      (host) => url.hostname === host || url.hostname.endsWith(`.${host}`),
    );
  } catch {
    return false;
  }
}

async function openExternal(rawUrl: string): Promise<void> {
  try {
    const url = new URL(rawUrl);
    if (url.protocol === 'https:' || url.protocol === 'mailto:') {
      await shell.openExternal(rawUrl);
    }
  } catch {
    return;
  }
}

function createMenu(): void {
  const template: Electron.MenuItemConstructorOptions[] = [
    ...(process.platform === 'darwin' ? [{ role: 'appMenu' as const }] : []),
    {
      label: 'Portal',
      submenu: [
        {
          label: 'Show Portal',
          accelerator: 'CmdOrCtrl+Shift+P',
          click: () => createPortalWindow(),
        },
        {
          label: 'Open Outlook in Browser',
          accelerator: 'CmdOrCtrl+Shift+O',
          click: () => void openExternal(OUTLOOK_URL),
        },
        {
          label: 'Open Outlook Desktop Window',
          click: () => createOutlookWindow(),
        },
        {
          label: 'Token Dashboard',
          accelerator: 'CmdOrCtrl+,',
          click: () => createAccountWindow(),
        },
        { type: 'separator' },
        process.platform === 'darwin'
          ? { role: 'close' as const }
          : { role: 'quit' as const },
      ],
    },
    {
      label: 'Edit',
      submenu: [
        { role: 'undo' },
        { role: 'redo' },
        { type: 'separator' },
        { role: 'cut' },
        { role: 'copy' },
        { role: 'paste' },
        { role: 'selectAll' },
      ],
    },
    {
      label: 'View',
      submenu: [
        { role: 'reload' },
        { role: 'forceReload' },
        { type: 'separator' },
        { role: 'resetZoom' },
        { role: 'zoomIn' },
        { role: 'zoomOut' },
        { type: 'separator' },
        { role: 'togglefullscreen' },
      ],
    },
    {
      label: 'Window',
      submenu: [{ role: 'minimize' }, { role: 'zoom' }],
    },
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

function createPortalWindow(): void {
  if (portalWindow) {
    portalWindow.show();
    portalWindow.focus();
    return;
  }

  portalWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 980,
    minHeight: 680,
    show: false,
    title: 'Outlook Portal',
    backgroundColor: '#10101f',
    webPreferences: {
      preload: path.join(__dirname, 'portal-preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: true,
    },
  });

  const portalPageUrl = pathToFileURL(path.join(__dirname, 'portal', 'index.html')).toString();
  portalWindow.once('ready-to-show', () => portalWindow?.show());
  portalWindow.on('closed', () => {
    portalWindow = null;
  });
  portalWindow.webContents.setWindowOpenHandler(({ url }) => {
    void openExternal(url);
    return { action: 'deny' };
  });
  portalWindow.webContents.on('will-navigate', (event, url) => {
    if (url !== portalPageUrl) {
      event.preventDefault();
    }
  });
  void portalWindow.loadURL(portalPageUrl);
}

function createOutlookWindow(): void {
  if (outlookWindow) {
    outlookWindow.show();
    outlookWindow.focus();
    return;
  }

  outlookWindow = new BrowserWindow({
    width: 1440,
    height: 920,
    minWidth: 900,
    minHeight: 600,
    show: false,
    backgroundColor: '#f5f5f5',
    title: 'Outlook Desktop',
    autoHideMenuBar: process.platform !== 'darwin',
    webPreferences: {
      partition: 'persist:outlook',
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: true,
      spellcheck: true,
    },
  });

  outlookWindow.once('ready-to-show', () => outlookWindow?.show());
  outlookWindow.on('closed', () => {
    outlookWindow = null;
  });
  outlookWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (!isTrustedUrl(url)) {
      void openExternal(url);
      return { action: 'deny' };
    }
    return {
      action: 'allow',
      overrideBrowserWindowOptions: {
        parent: outlookWindow ?? undefined,
        webPreferences: {
          partition: 'persist:outlook',
          contextIsolation: true,
          nodeIntegration: false,
          sandbox: true,
          webSecurity: true,
        },
      },
    };
  });
  outlookWindow.webContents.on('will-navigate', (event, url) => {
    if (!isTrustedUrl(url)) {
      event.preventDefault();
      void openExternal(url);
    }
  });
  outlookWindow.webContents.on('page-title-updated', (_event, title) => {
    const unreadCount = Number(title.match(/^\((\d+)\)/)?.[1] ?? 0);
    app.setBadgeCount(unreadCount);
  });
  void outlookWindow.loadURL(OUTLOOK_URL);
}

function createAccountWindow(): void {
  if (accountWindow) {
    accountWindow.show();
    accountWindow.focus();
    return;
  }

  accountWindow = new BrowserWindow({
    width: 1180,
    height: 860,
    minWidth: 940,
    minHeight: 680,
    title: 'Microsoft Token Dashboard',
    backgroundColor: '#f4f7fb',
    webPreferences: {
      preload: path.join(__dirname, 'account-preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: true,
    },
  });

  const accountPageUrl = pathToFileURL(path.join(__dirname, 'account', 'index.html')).toString();
  accountWindow.on('closed', () => {
    accountWindow = null;
  });
  accountWindow.webContents.setWindowOpenHandler(({ url }) => {
    void openExternal(url);
    return { action: 'deny' };
  });
  accountWindow.webContents.on('will-navigate', (event, url) => {
    if (url !== accountPageUrl) {
      event.preventDefault();
    }
  });
  void accountWindow.loadURL(accountPageUrl);
}

const hasLock = app.requestSingleInstanceLock();
if (!hasLock) {
  app.quit();
} else {
  app.on('second-instance', () => createPortalWindow());

  app.whenReady().then(async () => {
    app.setAppUserModelId('com.aprelay.outlookdesktop');
    accountManager = new MicrosoftAccountManager();
    portalManager = new PortalConnectionManager();
    await Promise.all([accountManager.initialize(), portalManager.initialize()]);

    const outlookSession = session.fromPartition(OUTLOOK_PARTITION);
    const browserUserAgent = outlookSession.getUserAgent().replace(/\sElectron\/\S+/, '');
    outlookSession.setUserAgent(browserUserAgent);
    outlookSession.setPermissionRequestHandler((webContents, permission, callback) => {
      const trusted = isTrustedUrl(webContents.getURL());
      callback(trusted && permission === 'notifications');
    });

    ipcMain.handle('open-external', (_event, url: unknown) => {
      if (typeof url === 'string') {
        return openExternal(url);
      }
      return undefined;
    });
    ipcMain.handle('portal:get-config', () => portalManager?.getConfig());
    ipcMain.handle(
      'portal:save-config',
      (_event, config: { serverUrl: string; accessKey: string }) =>
        portalManager?.saveConfig(config.serverUrl, config.accessKey),
    );
    ipcMain.handle('portal:connect', () => portalManager?.connect());
    ipcMain.handle('portal:get-device-config', async () => {
      const state = await accountManager?.getState();
      return state?.config;
    });
    ipcMain.handle(
      'portal:start-device-code',
      async (event, config: { clientId: string; tenantId: string }) => {
        if (!accountManager) {
          throw new Error('Account manager is not ready.');
        }
        await accountManager.saveConfig(config);
        return accountManager.signIn((response) => {
          event.sender.send('portal:device-code', {
            userCode: response.userCode,
            verificationUri: response.verificationUri,
            expiresIn: response.expiresIn,
            message: response.message,
          });
        });
      },
    );
    ipcMain.handle('portal:open-outlook', () => openExternal(OUTLOOK_URL));
    ipcMain.handle('portal:open-ms-office', () => createOutlookWindow());
    ipcMain.handle('portal:session-status', () => getOutlookSessionStatus());
    ipcMain.handle('portal:clear-session', () => clearOutlookSession());
    ipcMain.handle('portal:account-summary', () => accountManager?.getState());
    ipcMain.handle('portal:refresh-account', (_event, homeAccountId: string) =>
      accountManager?.refresh(homeAccountId),
    );
    ipcMain.handle('portal:remove-account', (_event, homeAccountId: string) =>
      accountManager?.remove(homeAccountId),
    );
    ipcMain.handle('portal:open-token-dashboard', () => createAccountWindow());
    ipcMain.handle('portal:open-admin-center', () => openExternal(ADMIN_CENTER_URL));

    ipcMain.handle('account:get-state', () => accountManager?.getState());
    ipcMain.handle('account:save-config', (_event, config: { clientId: string; tenantId: string }) =>
      accountManager?.saveConfig(config),
    );
    ipcMain.handle('account:sign-in', async (event) => {
      if (!accountManager) {
        throw new Error('Account manager is not ready.');
      }
      return accountManager.signIn((response) => {
        event.sender.send('account:device-code', {
          userCode: response.userCode,
          verificationUri: response.verificationUri,
          expiresIn: response.expiresIn,
          message: response.message,
        });
      });
    });
    ipcMain.handle('account:refresh', (_event, homeAccountId: string) =>
      accountManager?.refresh(homeAccountId),
    );
    ipcMain.handle('account:remove', (_event, homeAccountId: string) =>
      accountManager?.remove(homeAccountId),
    );
    ipcMain.handle('account:remove-all', () => accountManager?.removeAll());

    createMenu();
    createPortalWindow();

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) {
        createPortalWindow();
      }
    });
  });
}

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
