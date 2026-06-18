import {
  PublicClientApplication,
  Configuration,
  AuthenticationResult,
  LogLevel,
} from '@azure/msal-node';
import { BrowserWindow } from 'electron';
import { TokenStore } from './tokenStore';

const REDIRECT_URI = 'http://localhost:3847';

const MSAL_CONFIG: Configuration = {
  auth: {
    clientId: process.env.AZURE_CLIENT_ID || 'YOUR_AZURE_CLIENT_ID',
    authority: 'https://login.microsoftonline.com/common',
  },
  system: {
    loggerOptions: {
      loggerCallback(_loglevel: LogLevel, message: string) {
        if (process.env.NODE_ENV === 'development') {
          console.log('[MSAL]', message);
        }
      },
      piiLoggingEnabled: false,
      logLevel: LogLevel.Warning,
    },
  },
};

const SCOPES = [
  'openid',
  'profile',
  'offline_access',
  'User.Read',
  'Mail.Read',
  'Mail.ReadWrite',
  'Mail.Send',
  'MailboxSettings.Read',
];

export class AuthManager {
  private pca: PublicClientApplication;
  private tokenStore: TokenStore;
  private accountId: string | null = null;

  constructor(tokenStore: TokenStore) {
    this.pca = new PublicClientApplication(MSAL_CONFIG);
    this.tokenStore = tokenStore;
    this.accountId = this.tokenStore.getAccountId();
  }

  async login(parentWindow: BrowserWindow): Promise<AuthenticationResult | null> {
    const authWindow = new BrowserWindow({
      width: 500,
      height: 700,
      parent: parentWindow,
      modal: true,
      show: false,
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
      },
    });

    try {
      const authCodeUrl = await this.pca.getAuthCodeUrl({
        scopes: SCOPES,
        redirectUri: REDIRECT_URI,
        prompt: 'select_account',
      });

      authWindow.loadURL(authCodeUrl);
      authWindow.show();

      const authCode = await new Promise<string>((resolve, reject) => {
        authWindow.webContents.on('will-redirect', (_event, url) => {
          const urlObj = new URL(url);
          const code = urlObj.searchParams.get('code');
          const error = urlObj.searchParams.get('error');

          if (code) {
            resolve(code);
          } else if (error) {
            reject(new Error(`Auth error: ${error} - ${urlObj.searchParams.get('error_description')}`));
          }
        });

        authWindow.webContents.on('will-navigate', (_event, url) => {
          try {
            const urlObj = new URL(url);
            const code = urlObj.searchParams.get('code');
            const error = urlObj.searchParams.get('error');

            if (code) {
              resolve(code);
            } else if (error) {
              reject(new Error(`Auth error: ${error}`));
            }
          } catch {
            // not a valid URL, ignore
          }
        });

        authWindow.on('closed', () => {
          reject(new Error('Auth window was closed'));
        });
      });

      authWindow.close();

      const tokenResponse = await this.pca.acquireTokenByCode({
        code: authCode,
        scopes: SCOPES,
        redirectUri: REDIRECT_URI,
      });

      if (tokenResponse?.account) {
        this.accountId = tokenResponse.account.homeAccountId;
        this.tokenStore.saveAccountId(this.accountId);
        this.tokenStore.saveTokenCache(this.pca.getTokenCache().serialize());
      }

      return tokenResponse;
    } catch (error) {
      if (!authWindow.isDestroyed()) {
        authWindow.close();
      }
      throw error;
    }
  }

  async acquireTokenSilent(): Promise<string | null> {
    if (!this.accountId) return null;

    const cachedData = this.tokenStore.getTokenCache();
    if (cachedData) {
      this.pca.getTokenCache().deserialize(cachedData);
    }

    const accounts = await this.pca.getTokenCache().getAllAccounts();
    const account = accounts.find(a => a.homeAccountId === this.accountId);

    if (!account) {
      this.tokenStore.clear();
      this.accountId = null;
      return null;
    }

    try {
      const result = await this.pca.acquireTokenSilent({
        scopes: SCOPES,
        account,
      });

      this.tokenStore.saveTokenCache(this.pca.getTokenCache().serialize());
      return result?.accessToken ?? null;
    } catch {
      this.tokenStore.clear();
      this.accountId = null;
      return null;
    }
  }

  async getAccessToken(): Promise<string> {
    const token = await this.acquireTokenSilent();
    if (!token) {
      throw new Error('No valid token available. Please login again.');
    }
    return token;
  }

  async logout(): Promise<void> {
    this.tokenStore.clear();
    this.accountId = null;

    try {
      const accounts = await this.pca.getTokenCache().getAllAccounts();
      for (const account of accounts) {
        await this.pca.getTokenCache().removeAccount(account);
      }
    } catch {
      // Token cache may already be empty
    }
  }

  isAuthenticated(): boolean {
    return this.accountId !== null;
  }
}
