import {
  PublicClientApplication,
  Configuration,
  AuthenticationResult,
  LogLevel,
  DeviceCodeRequest,
} from '@azure/msal-node';
import { BrowserWindow, shell } from 'electron';
import { TokenStore } from './tokenStore';

const MSAL_CONFIG: Configuration = {
  auth: {
    clientId: process.env.AZURE_CLIENT_ID || 'd3590ed6-52b3-4102-aeff-aad2292ab01c',
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

export interface DeviceCodeInfo {
  userCode: string;
  verificationUri: string;
  message: string;
  expiresIn: number;
}

export class AuthManager {
  private pca: PublicClientApplication;
  private tokenStore: TokenStore;
  private accountId: string | null = null;

  constructor(tokenStore: TokenStore) {
    this.pca = new PublicClientApplication(MSAL_CONFIG);
    this.tokenStore = tokenStore;
    this.accountId = this.tokenStore.getAccountId();
  }

  async loginWithDeviceCode(mainWindow: BrowserWindow): Promise<AuthenticationResult | null> {
    return new Promise((resolve, reject) => {
      const deviceCodeRequest: DeviceCodeRequest = {
        scopes: SCOPES,
        deviceCodeCallback: (response) => {
          const deviceCodeInfo: DeviceCodeInfo = {
            userCode: response.userCode,
            verificationUri: response.verificationUri,
            message: response.message,
            expiresIn: response.expiresIn ?? 900,
          };

          mainWindow.webContents.send('auth:deviceCode', deviceCodeInfo);
        },
      };

      this.pca
        .acquireTokenByDeviceCode(deviceCodeRequest)
        .then((tokenResponse) => {
          if (tokenResponse?.account) {
            this.accountId = tokenResponse.account.homeAccountId;
            this.tokenStore.saveAccountId(this.accountId);
            this.tokenStore.saveTokenCache(this.pca.getTokenCache().serialize());
          }
          mainWindow.webContents.send('auth:deviceCodeComplete', { success: true });
          resolve(tokenResponse);
        })
        .catch((error) => {
          mainWindow.webContents.send('auth:deviceCodeComplete', {
            success: false,
            error: error instanceof Error ? error.message : 'Authentication failed',
          });
          reject(error);
        });
    });
  }

  openVerificationPage(url: string): void {
    shell.openExternal(url);
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
