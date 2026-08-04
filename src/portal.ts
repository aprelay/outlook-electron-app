import { app, safeStorage } from 'electron';
import fs from 'node:fs/promises';
import path from 'node:path';

type PortalConfig = {
  serverUrl: string;
  hasAccessKey: boolean;
  securePersistenceAvailable: boolean;
};

type StoredPortalConfig = {
  serverUrl: string;
};

function canPersistSecurely(): boolean {
  if (!safeStorage.isEncryptionAvailable()) {
    return false;
  }
  return process.platform !== 'linux' || safeStorage.getSelectedStorageBackend() !== 'basic_text';
}

function validateServerUrl(rawUrl: string): string {
  const url = new URL(rawUrl.trim());
  if (url.protocol !== 'https:') {
    throw new Error('The portal server must use HTTPS.');
  }
  return url.origin;
}

export class PortalConnectionManager {
  private serverUrl = '';
  private accessKey = '';
  private readonly configPath = path.join(app.getPath('userData'), 'portal-config.json');
  private readonly keyPath = path.join(app.getPath('userData'), 'portal-access-key.bin');

  async initialize(): Promise<void> {
    try {
      const stored = JSON.parse(await fs.readFile(this.configPath, 'utf8')) as StoredPortalConfig;
      this.serverUrl = validateServerUrl(stored.serverUrl);
    } catch {
      this.serverUrl = '';
    }

    if (!canPersistSecurely()) {
      return;
    }
    try {
      const encrypted = await fs.readFile(this.keyPath);
      this.accessKey = safeStorage.decryptString(encrypted);
    } catch {
      this.accessKey = '';
    }
  }

  getConfig(): PortalConfig {
    return {
      serverUrl: this.serverUrl,
      hasAccessKey: this.accessKey.length > 0,
      securePersistenceAvailable: canPersistSecurely(),
    };
  }

  async saveConfig(serverUrl: string, accessKey: string): Promise<PortalConfig> {
    this.serverUrl = validateServerUrl(serverUrl);
    const normalizedKey = accessKey.trim();
    if (normalizedKey) {
      this.accessKey = normalizedKey;
    }

    await fs.mkdir(path.dirname(this.configPath), { recursive: true });
    await fs.writeFile(this.configPath, JSON.stringify({ serverUrl: this.serverUrl }), { mode: 0o600 });

    if (normalizedKey && canPersistSecurely()) {
      await fs.writeFile(this.keyPath, safeStorage.encryptString(normalizedKey), { mode: 0o600 });
    }
    return this.getConfig();
  }

  async connect(): Promise<{ serverUrl: string; status: string }> {
    if (!this.serverUrl || !this.accessKey) {
      throw new Error('Enter and save both the HTTPS server URL and access key.');
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10_000);
    try {
      const response = await fetch(`${this.serverUrl}/api/health`, {
        headers: { Authorization: `Bearer ${this.accessKey}` },
        signal: controller.signal,
      });
      if (!response.ok) {
        throw new Error(`Portal server returned HTTP ${response.status}.`);
      }
      return { serverUrl: this.serverUrl, status: 'connected' };
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        throw new Error('Portal server connection timed out.');
      }
      throw error;
    } finally {
      clearTimeout(timeout);
    }
  }
}
