import {
  type AccountInfo,
  type AuthenticationResult,
  type ICachePlugin,
  PublicClientApplication,
  type TokenCacheContext,
} from '@azure/msal-node';
import { app, safeStorage } from 'electron';
import fs from 'node:fs/promises';
import path from 'node:path';

const DEFAULT_TENANT = 'organizations';
const MAIL_SCOPES = ['User.Read', 'Mail.ReadWrite', 'Mail.Send', 'offline_access'];

type DeviceCodeResponse = {
  userCode: string;
  deviceCode: string;
  verificationUri: string;
  expiresIn: number;
  interval: number;
  message: string;
};

type AccountConfig = {
  clientId: string;
  tenantId: string;
};

type AccountSummary = {
  homeAccountId: string;
  name: string;
  username: string;
  tenantId: string;
};

export type AccountState = {
  config: AccountConfig;
  accounts: AccountSummary[];
  securePersistenceAvailable: boolean;
};

export type RefreshResult = {
  account: AccountSummary;
  expiresOn: string | null;
  scopes: string[];
};

function canPersistSecurely(): boolean {
  if (!safeStorage.isEncryptionAvailable()) {
    return false;
  }
  return process.platform !== 'linux' || safeStorage.getSelectedStorageBackend() !== 'basic_text';
}

class SecureTokenCache implements ICachePlugin {
  constructor(private readonly cachePath: string) {}

  async beforeCacheAccess(context: TokenCacheContext): Promise<void> {
    if (!canPersistSecurely()) {
      return;
    }

    try {
      const encoded = await fs.readFile(this.cachePath, 'utf8');
      const decrypted = safeStorage.decryptString(Buffer.from(encoded, 'base64'));
      context.tokenCache.deserialize(decrypted);
    } catch (error) {
      const missingFile = error instanceof Error && 'code' in error && error.code === 'ENOENT';
      if (!missingFile) {
        await fs.rm(this.cachePath, { force: true });
      }
    }
  }

  async afterCacheAccess(context: TokenCacheContext): Promise<void> {
    if (!context.cacheHasChanged || !canPersistSecurely()) {
      return;
    }

    await fs.mkdir(path.dirname(this.cachePath), { recursive: true });
    const encrypted = safeStorage.encryptString(context.tokenCache.serialize());
    await fs.writeFile(this.cachePath, encrypted.toString('base64'), { mode: 0o600 });
  }
}

function summarizeAccount(account: AccountInfo): AccountSummary {
  return {
    homeAccountId: account.homeAccountId,
    name: account.name ?? 'Microsoft 365 account',
    username: account.username,
    tenantId: account.tenantId,
  };
}

function validateConfig(config: AccountConfig): AccountConfig {
  const clientId = config.clientId.trim();
  const tenantId = config.tenantId.trim() || DEFAULT_TENANT;

  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(clientId)) {
    throw new Error('Enter the Application (client) ID from Microsoft Entra.');
  }
  if (!/^[a-z0-9.-]+$/i.test(tenantId)) {
    throw new Error('Enter a valid tenant ID, tenant domain, or organizations.');
  }

  return { clientId, tenantId };
}

export class MicrosoftAccountManager {
  private application: PublicClientApplication | null = null;
  private config: AccountConfig = { clientId: '', tenantId: DEFAULT_TENANT };
  private readonly configPath = path.join(app.getPath('userData'), 'account-config.json');
  private readonly cachePath = path.join(app.getPath('userData'), 'msal-cache.bin');

  async initialize(): Promise<void> {
    try {
      const stored = JSON.parse(await fs.readFile(this.configPath, 'utf8')) as AccountConfig;
      this.config = validateConfig(stored);
      this.application = this.createApplication();
    } catch {
      this.config = { clientId: '', tenantId: DEFAULT_TENANT };
    }
  }

  async getState(): Promise<AccountState> {
    const accounts = this.application
      ? await this.application.getTokenCache().getAllAccounts()
      : [];

    return {
      config: this.config,
      accounts: accounts.map(summarizeAccount),
      securePersistenceAvailable: canPersistSecurely(),
    };
  }

  async saveConfig(config: AccountConfig): Promise<AccountState> {
    const nextConfig = validateConfig(config);
    const changed =
      nextConfig.clientId !== this.config.clientId || nextConfig.tenantId !== this.config.tenantId;
    this.config = nextConfig;
    if (changed) {
      await fs.rm(this.cachePath, { force: true });
    }
    await fs.mkdir(path.dirname(this.configPath), { recursive: true });
    await fs.writeFile(this.configPath, JSON.stringify(this.config), { mode: 0o600 });
    this.application = this.createApplication();
    return this.getState();
  }

  async signIn(onDeviceCode: (response: DeviceCodeResponse) => void): Promise<RefreshResult> {
    const application = this.requireApplication();
    const result = await application.acquireTokenByDeviceCode({
      scopes: MAIL_SCOPES,
      deviceCodeCallback: onDeviceCode,
    });

    if (!result) {
      throw new Error('Microsoft did not return an account token.');
    }

    return this.summarizeResult(result);
  }

  async refresh(homeAccountId: string): Promise<RefreshResult> {
    const application = this.requireApplication();
    const account = await application.getTokenCache().getAccountByHomeId(homeAccountId);
    if (!account) {
      throw new Error('That account is no longer available.');
    }

    const result = await application.acquireTokenSilent({
      account,
      scopes: MAIL_SCOPES,
    });
    return this.summarizeResult(result);
  }

  async remove(homeAccountId: string): Promise<AccountState> {
    const application = this.requireApplication();
    const account = await application.getTokenCache().getAccountByHomeId(homeAccountId);
    if (account) {
      await application.getTokenCache().removeAccount(account);
    }
    return this.getState();
  }

  private createApplication(): PublicClientApplication {
    return new PublicClientApplication({
      auth: {
        clientId: this.config.clientId,
        authority: `https://login.microsoftonline.com/${this.config.tenantId}`,
      },
      cache: {
        cachePlugin: new SecureTokenCache(this.cachePath),
      },
    });
  }

  private requireApplication(): PublicClientApplication {
    if (!this.application) {
      throw new Error('Save your Microsoft Entra client ID before signing in.');
    }
    return this.application;
  }

  private summarizeResult(result: AuthenticationResult): RefreshResult {
    if (!result.account) {
      throw new Error('Microsoft did not return account details.');
    }

    return {
      account: summarizeAccount(result.account),
      expiresOn: result.expiresOn?.toISOString() ?? null,
      scopes: result.scopes,
    };
  }
}
