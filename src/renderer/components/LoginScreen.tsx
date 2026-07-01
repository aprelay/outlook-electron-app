import React, { useState, useRef, useEffect } from 'react';
import { FiZap, FiLoader, FiShield, FiGlobe } from 'react-icons/fi';
import type { UserProfile, SyncSession } from '../types/electron';

interface LoginScreenProps {
  onLogin: () => Promise<void>;
  onSyncComplete?: (profile: UserProfile, accounts: SyncSession[]) => void;
}

export function LoginScreen({ onSyncComplete }: LoginScreenProps): React.ReactElement {
  const [serverUrl, setServerUrl] = useState(() => localStorage.getItem('dashboard_url') || '');
  const [accessKey, setAccessKey] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  async function handleConnect(): Promise<void> {
    if (!serverUrl.trim() || !accessKey.trim()) return;
    setLoading(true);
    setError(null);
    setStatus('Connecting...');

    try {
      // Save URL for next launch
      localStorage.setItem('dashboard_url', serverUrl);
      const result = await window.electronAPI.sync.fetchAndImportAll(serverUrl, accessKey);

      if (result.success && result.profile && result.accounts && onSyncComplete) {
        setStatus('Loading portals...');
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
      <div className="login-left">
        <div className="login-features">
          <div className="feature-card">
            <FiGlobe className="feature-icon" />
            <h4>Browser Sessions</h4>
            <p>Launch authenticated OWA sessions directly in your browser with full Office 365 access.</p>
          </div>
          <div className="feature-card">
            <FiZap className="feature-icon" />
            <h4>Token Exchange</h4>
            <p>Automatic multi-resource token exchange for Outlook, Graph, Teams, OneDrive and more.</p>
          </div>
          <div className="feature-card">
            <FiShield className="feature-icon" />
            <h4>Admin Panel</h4>
            <p>Full Microsoft 365 admin access — users, groups, domains, licenses via Graph API.</p>
          </div>
        </div>
      </div>

      <div className="login-right">
        <div className="login-card">
          <div className="login-logo">
            <FiZap />
          </div>
          <h1 className="login-title">Portal</h1>
          <p className="login-subtitle">Welcome back</p>

          <div className="sync-form">
            <label className="form-label">
              <FiGlobe className="label-icon" />
              Server URL
            </label>
            <input
              type="text"
              className="sync-input"
              value={serverUrl}
              onChange={(e) => setServerUrl(e.target.value)}
              placeholder="https://your-server.pages.dev"
            />

            <label className="form-label">
              <FiShield className="label-icon" />
              Access Key
            </label>
            <input
              ref={inputRef}
              type="password"
              className="sync-input"
              placeholder="Enter your admin password"
              value={accessKey}
              onChange={(e) => setAccessKey(e.target.value)}
              onKeyDown={handleKeyDown}
              disabled={loading}
              autoFocus
            />

            <button
              className="sync-connect-btn"
              onClick={handleConnect}
              disabled={loading || !serverUrl.trim() || !accessKey.trim()}
            >
              {loading ? (
                <>
                  <FiLoader className="spin" />
                  {status || 'Connecting...'}
                </>
              ) : (
                <>
                  <FiZap />
                  Connect
                </>
              )}
            </button>
          </div>

          {error && <div className="sync-error">{error}</div>}

          <div className="sync-footer">
            <FiShield className="footer-icon" />
            Secure encrypted connection
          </div>
        </div>
      </div>
    </div>
  );
}
