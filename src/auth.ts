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
const DAY_MS = 24 * 60 * 60 * 1000;

const RESOURCE_SCOPES: { resource: string; scopes: string[] }[] = [
  { resource: 'Outlook Mail', scopes: ['Mail.ReadWrite', 'Mail.Send'] },
  { resource: 'Microsoft Graph', scopes: ['User.Read'] },
  { resource: 'Microsoft Teams', scopes: ['https://graph.microsoft.com/Chat.Read'] },
  { resource: 'OneDrive', scopes: ['Files.ReadWrite'] },
];

export type ResourceTokenStatus = {
  resource: string;
  status: 'active' | 'unavailable';
  expiresOn: string | null;
};

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
  expiresOn: string | null;
  lastRefreshedAt: string | null;
  scopes: string[];
  status: 'active' | 'expired' | 'unknown';
};

export type AuditEvent = {
  id: string;
  action: 'connected' | 'refreshed' | 'refresh_failed' | 'removed' | 'configuration_updated';
  account: string | null;
  timestamp: string;
  success: boolean;
};

type SessionMetadata = {
  homeAccountId: string;
  expiresOn: string | null;
  lastRefreshedAt: string;
  scopes: string[];
};

type LifecycleData = {
  sessions: SessionMetadata[];
  audit: AuditEvent[];
};

export type AccountState = {
  config: AccountConfig;
  accounts: AccountSummary[];
  audit: AuditEvent[];
  metrics: {
    totalSessions: number;
    activeSessions: number;
    refreshes24h: number;
    failedRefreshes24h: number;
  };
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

function statusFor(expiresOn: string | null): AccountSummary['status'] {
  if (!expiresOn) {
    return 'unknown';
  }
  return Date.parse(expiresOn) > Date.now() ? 'active' : 'expired';
}

export class MicrosoftAccountManager {
  private application: PublicClientApplication | null = null;
  private config: AccountConfig = { clientId: '', tenantId: DEFAULT_TENANT };
  private lifecycle: LifecycleData = { sessions: [], audit: [] };
  private readonly configPath = path.join(app.getPath('userData'), 'account-config.json');
  private readonly cachePath = path.join(app.getPath('userData'), 'msal-cache.bin');
  private readonly lifecyclePath = path.join(app.getPath('userData'), 'token-lifecycle.json');

  async initialize(): Promise<void> {
    try {
      const stored = JSON.parse(await fs.readFile(this.configPath, 'utf8')) as AccountConfig;
      this.config = validateConfig(stored);
      this.application = this.createApplication();
    } catch {
      this.config = { clientId: '', tenantId: DEFAULT_TENANT };
    }

    try {
      this.lifecycle = JSON.parse(await fs.readFile(this.lifecyclePath, 'utf8')) as LifecycleData;
    } catch {
      this.lifecycle = { sessions: [], audit: [] };
    }
  }

  async getState(): Promise<AccountState> {
    const accounts = this.application
      ? await this.application.getTokenCache().getAllAccounts()
      : [];
    const summaries = accounts.map((account) => this.summarizeAccount(account));
    const cutoff = Date.now() - DAY_MS;
    const recentAudit = this.lifecycle.audit.filter((event) => Date.parse(event.timestamp) >= cutoff);

    return {
      config: this.config,
      accounts: summaries,
      audit: this.lifecycle.audit.slice(0, 100),
      metrics: {
        totalSessions: summaries.length,
        activeSessions: summaries.filter((account) => account.status === 'active').length,
        refreshes24h: recentAudit.filter((event) => event.action === 'refreshed').length,
        failedRefreshes24h: recentAudit.filter((event) => event.action === 'refresh_failed').length,
      },
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
      this.lifecycle.sessions = [];
      this.addAudit('configuration_updated', null, true);
      await this.persistLifecycle();
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

    return this.recordResult(result, 'connected');
  }

  async refresh(homeAccountId: string): Promise<RefreshResult> {
    const application = this.requireApplication();
    const account = await application.getTokenCache().getAccountByHomeId(homeAccountId);
    if (!account) {
      throw new Error('That account is no longer available.');
    }

    try {
      const result = await application.acquireTokenSilent({
        account,
        scopes: MAIL_SCOPES,
        forceRefresh: true,
      });
      return await this.recordResult(result, 'refreshed');
    } catch (error) {
      this.addAudit('refresh_failed', account.username, false);
      await this.persistLifecycle();
      throw error;
    }
  }

  async exchangeResources(homeAccountId: string): Promise<ResourceTokenStatus[]> {
    const application = this.requireApplication();
    const account = await application.getTokenCache().getAccountByHomeId(homeAccountId);
    if (!account) {
      throw new Error('That account is no longer available.');
    }

    const results: ResourceTokenStatus[] = [];
    for (const entry of RESOURCE_SCOPES) {
      try {
        const result = await application.acquireTokenSilent({
          account,
          scopes: entry.scopes,
        });
        results.push({
          resource: entry.resource,
          status: 'active',
          expiresOn: result.expiresOn?.toISOString() ?? null,
        });
      } catch {
        results.push({ resource: entry.resource, status: 'unavailable', expiresOn: null });
      }
    }

    this.addAudit('refreshed', account.username, results.some((item) => item.status === 'active'));
    await this.persistLifecycle();
    return results;
  }

  async remove(homeAccountId: string): Promise<AccountState> {
    const application = this.requireApplication();
    const account = await application.getTokenCache().getAccountByHomeId(homeAccountId);
    if (account) {
      await application.getTokenCache().removeAccount(account);
      this.lifecycle.sessions = this.lifecycle.sessions.filter(
        (session) => session.homeAccountId !== homeAccountId,
      );
      this.addAudit('removed', account.username, true);
      await this.persistLifecycle();
    }
    return this.getState();
  }

  async removeAll(): Promise<AccountState> {
    const application = this.requireApplication();
    const accounts = await application.getTokenCache().getAllAccounts();
    for (const account of accounts) {
      await application.getTokenCache().removeAccount(account);
      this.addAudit('removed', account.username, true);
    }
    this.lifecycle.sessions = [];
    await this.persistLifecycle();
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

  private summarizeAccount(account: AccountInfo): AccountSummary {
    const metadata = this.lifecycle.sessions.find(
      (session) => session.homeAccountId === account.homeAccountId,
    );
    const expiresOn = metadata?.expiresOn ?? null;
    return {
      homeAccountId: account.homeAccountId,
      name: account.name ?? 'Microsoft 365 account',
      username: account.username,
      tenantId: account.tenantId,
      expiresOn,
      lastRefreshedAt: metadata?.lastRefreshedAt ?? null,
      scopes: metadata?.scopes ?? [],
      status: statusFor(expiresOn),
    };
  }

  private async recordResult(
    result: AuthenticationResult,
    action: 'connected' | 'refreshed',
  ): Promise<RefreshResult> {
    if (!result.account) {
      throw new Error('Microsoft did not return account details.');
    }

    const timestamp = new Date().toISOString();
    const metadata: SessionMetadata = {
      homeAccountId: result.account.homeAccountId,
      expiresOn: result.expiresOn?.toISOString() ?? null,
      lastRefreshedAt: timestamp,
      scopes: [...result.scopes].sort(),
    };
    this.lifecycle.sessions = [
      metadata,
      ...this.lifecycle.sessions.filter(
        (session) => session.homeAccountId !== result.account?.homeAccountId,
      ),
    ];
    this.addAudit(action, result.account.username, true);
    await this.persistLifecycle();

    const account = this.summarizeAccount(result.account);
    return { account, expiresOn: account.expiresOn, scopes: account.scopes };
  }

  private addAudit(action: AuditEvent['action'], account: string | null, success: boolean): void {
    this.lifecycle.audit = [
      {
        id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
        action,
        account,
        timestamp: new Date().toISOString(),
        success,
      },
      ...this.lifecycle.audit,
    ].slice(0, 200);
  }

  private async persistLifecycle(): Promise<void> {
    await fs.mkdir(path.dirname(this.lifecyclePath), { recursive: true });
    await fs.writeFile(this.lifecyclePath, JSON.stringify(this.lifecycle), { mode: 0o600 });
  }
}
