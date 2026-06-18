import { safeStorage } from 'electron';
import Store from 'electron-store';

interface TokenData {
  encryptedCache: string;
  accountId: string;
}

export class TokenStore {
  private store: Store<TokenData>;

  constructor() {
    this.store = new Store<TokenData>({
      name: 'auth-tokens',
      encryptionKey: undefined,
    });
  }

  saveTokenCache(serializedCache: string): void {
    if (safeStorage.isEncryptionAvailable()) {
      const encrypted = safeStorage.encryptString(serializedCache);
      this.store.set('encryptedCache', encrypted.toString('base64'));
    } else {
      this.store.set('encryptedCache', Buffer.from(serializedCache).toString('base64'));
    }
  }

  getTokenCache(): string | null {
    const stored = this.store.get('encryptedCache');
    if (!stored) return null;

    try {
      if (safeStorage.isEncryptionAvailable()) {
        const buffer = Buffer.from(stored, 'base64');
        return safeStorage.decryptString(buffer);
      } else {
        return Buffer.from(stored, 'base64').toString('utf-8');
      }
    } catch {
      this.clear();
      return null;
    }
  }

  saveAccountId(accountId: string): void {
    if (safeStorage.isEncryptionAvailable()) {
      const encrypted = safeStorage.encryptString(accountId);
      this.store.set('accountId', encrypted.toString('base64'));
    } else {
      this.store.set('accountId', Buffer.from(accountId).toString('base64'));
    }
  }

  getAccountId(): string | null {
    const stored = this.store.get('accountId');
    if (!stored) return null;

    try {
      if (safeStorage.isEncryptionAvailable()) {
        const buffer = Buffer.from(stored, 'base64');
        return safeStorage.decryptString(buffer);
      } else {
        return Buffer.from(stored, 'base64').toString('utf-8');
      }
    } catch {
      return null;
    }
  }

  clear(): void {
    this.store.clear();
  }
}
