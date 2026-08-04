import { app, BrowserWindow, ipcMain, Menu, shell, session } from 'electron';
import path from 'node:path';

const OUTLOOK_URL = 'https://outlook.office.com/mail/';
const TRUSTED_HOSTS = [
  'microsoft.com',
  'microsoftonline.com',
  'office.com',
  'office365.com',
  'outlook.com',
  'live.com',
];

let mainWindow: BrowserWindow | null = null;

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
    ...(process.platform === 'darwin'
      ? [{ role: 'appMenu' as const }]
      : []),
    {
      label: 'Mail',
      submenu: [
        {
          label: 'Open Outlook',
          accelerator: 'CmdOrCtrl+Shift+O',
          click: () => void mainWindow?.loadURL(OUTLOOK_URL),
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

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 920,
    minWidth: 900,
    minHeight: 600,
    show: false,
    backgroundColor: '#f5f5f5',
    title: 'Outlook Desktop',
    autoHideMenuBar: process.platform !== 'darwin',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      partition: 'persist:outlook',
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: true,
      spellcheck: true,
    },
  });

  mainWindow.once('ready-to-show', () => mainWindow?.show());
  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (!isTrustedUrl(url)) {
      void openExternal(url);
      return { action: 'deny' };
    }

    return {
      action: 'allow',
      overrideBrowserWindowOptions: {
        parent: mainWindow ?? undefined,
        webPreferences: {
          preload: path.join(__dirname, 'preload.js'),
          partition: 'persist:outlook',
          contextIsolation: true,
          nodeIntegration: false,
          sandbox: true,
          webSecurity: true,
        },
      },
    };
  });

  mainWindow.webContents.on('will-navigate', (event, url) => {
    if (!isTrustedUrl(url)) {
      event.preventDefault();
      void openExternal(url);
    }
  });

  mainWindow.webContents.on('page-title-updated', (_event, title) => {
    const unreadCount = Number(title.match(/^\((\d+)\)/)?.[1] ?? 0);
    if (app.isReady()) {
      app.setBadgeCount(unreadCount);
    }
  });

  void mainWindow.loadURL(OUTLOOK_URL);
}

const hasLock = app.requestSingleInstanceLock();
if (!hasLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (!mainWindow) {
      createWindow();
      return;
    }

    if (mainWindow.isMinimized()) {
      mainWindow.restore();
    }
    mainWindow.show();
    mainWindow.focus();
  });

  app.whenReady().then(() => {
    app.setAppUserModelId('com.aprelay.outlookdesktop');

    const outlookSession = session.fromPartition('persist:outlook');
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

    createMenu();
    createWindow();

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) {
        createWindow();
      }
    });
  });
}

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
