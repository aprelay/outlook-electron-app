import React, { useState, useRef, useEffect } from 'react';
import { FiDownloadCloud, FiLoader } from 'react-icons/fi';
import type { UserProfile, SyncSession } from '../types/electron';

interface LoginScreenProps {
  onLogin: () => Promise<void>;
  onSyncComplete?: (profile: UserProfile, accounts: SyncSession[]) => void;
}

export function LoginScreen({ onSyncComplete }: LoginScreenProps): React.ReactElement {
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  async function handleConnect(): Promise<void> {
    if (!password.trim()) return;
    setLoading(true);
    setError(null);
    setStatus('Connecting to dashboard...');

    try {
      setStatus('Syncing tokens...');
      const result = await window.electronAPI.sync.fetchAndImportAll(password);

      if (result.success && result.profile && result.accounts && onSyncComplete) {
        setStatus('Loading mailbox...');
        onSyncComplete(result.profile, result.accounts);
      } else {
        setError(result.error || 'Failed to sync tokens');
      }
    } catch {
      setError('Connection failed. Check your network.');
    } finally {
      setLoading(false);
      setStatus('');
    }
  }

  function handleKeyDown(e: React.KeyboardEvent): void {
    if (e.key === 'Enter') {
      handleConnect();
    }
  }

  return (
    <div className="login-screen">
      <div className="login-card">
        <div className="login-logo">
          <FiDownloadCloud />
        </div>
        <h1 className="login-title">Outlook Electron</h1>
        <p className="login-subtitle">
          Enter your dashboard password to sync tokens
        </p>

        <div className="sync-form">
          <input
            ref={inputRef}
            type="password"
            className="sync-input"
            placeholder="Dashboard password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={loading}
            autoFocus
          />

          <button
            className="sync-connect-btn"
            onClick={handleConnect}
            disabled={loading || !password.trim()}
          >
            {loading ? (
              <>
                <FiLoader className="spin" />
                {status || 'Connecting...'}
              </>
            ) : (
              <>
                <FiDownloadCloud />
                Sync Tokens
              </>
            )}
          </button>
        </div>

        {error && <div className="sync-error">{error}</div>}

        <div className="sync-footer">
          Connects to <code>outlook-token-dashboard.pages.dev</code>
        </div>
      </div>
    </div>
  );
}
