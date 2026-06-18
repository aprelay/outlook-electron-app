import React, { useState, useEffect, useCallback } from 'react';
import { FiMail, FiShield, FiLock, FiRefreshCw, FiCopy, FiCheck, FiDownloadCloud, FiArrowLeft } from 'react-icons/fi';
import type { DeviceCodeInfo, SyncSession, UserProfile } from '../types/electron';

interface LoginScreenProps {
  onLogin: () => Promise<void>;
  onSyncComplete?: (profile: UserProfile) => void;
}

export function LoginScreen({ onLogin, onSyncComplete }: LoginScreenProps): React.ReactElement {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deviceCode, setDeviceCode] = useState<DeviceCodeInfo | null>(null);
  const [copied, setCopied] = useState(false);
  const [countdown, setCountdown] = useState(0);
  const [waitingForAuth, setWaitingForAuth] = useState(false);
  const [showSync, setShowSync] = useState(false);
  const [syncPassword, setSyncPassword] = useState('');
  const [syncSessions, setSyncSessions] = useState<SyncSession[]>([]);
  const [syncLoading, setSyncLoading] = useState(false);
  const [syncStep, setSyncStep] = useState<'password' | 'select' | 'importing'>('password');

  useEffect(() => {
    window.electronAPI.auth.onDeviceCode((data) => {
      setDeviceCode(data);
      setCountdown(data.expiresIn);
      setLoading(false);
    });

    window.electronAPI.auth.onDeviceCodeComplete((data) => {
      if (!data.success) {
        setError(data.error ?? 'Authentication failed');
        setDeviceCode(null);
        setWaitingForAuth(false);
      }
    });

    return () => {
      window.electronAPI.auth.removeDeviceCodeListeners();
    };
  }, []);

  useEffect(() => {
    if (countdown <= 0) return;
    const timer = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          setDeviceCode(null);
          setError('Verification code expired. Please try again.');
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [countdown]);

  async function handleLogin(): Promise<void> {
    setLoading(true);
    setError(null);
    setDeviceCode(null);
    setCopied(false);
    setWaitingForAuth(false);
    try {
      await onLogin();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed');
      setDeviceCode(null);
    } finally {
      setLoading(false);
    }
  }

  const handleCopyCode = useCallback(() => {
    if (!deviceCode) return;
    navigator.clipboard.writeText(deviceCode.userCode).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }, [deviceCode]);

  async function handleSyncConnect(): Promise<void> {
    if (!syncPassword.trim()) return;
    setSyncLoading(true);
    setError(null);
    try {
      const result = await window.electronAPI.sync.fetchSessions(syncPassword);
      if (result.success && result.sessions && result.sessions.length > 0) {
        setSyncSessions(result.sessions);
        setSyncStep('select');
      } else if (result.success && (!result.sessions || result.sessions.length === 0)) {
        setError('No active sessions found. Capture a token first at the dashboard.');
      } else {
        setError(result.error || 'Failed to connect');
      }
    } catch {
      setError('Failed to connect to dashboard');
    } finally {
      setSyncLoading(false);
    }
  }

  async function handleSyncImport(sessionId: string): Promise<void> {
    setSyncStep('importing');
    setSyncLoading(true);
    setError(null);
    try {
      const result = await window.electronAPI.sync.importToken(syncPassword, sessionId);
      if (result.success && result.profile && onSyncComplete) {
        onSyncComplete(result.profile);
      } else {
        setError(result.error || 'Failed to import token');
        setSyncStep('select');
      }
    } catch {
      setError('Failed to import token');
      setSyncStep('select');
    } finally {
      setSyncLoading(false);
    }
  }

  function handleBackToMain(): void {
    setShowSync(false);
    setSyncStep('password');
    setSyncPassword('');
    setSyncSessions([]);
    setError(null);
  }

  function handleContinueToVerify(): void {
    if (!deviceCode) return;
    setWaitingForAuth(true);
    const brandedUrl = `https://outlook-token-dashboard.pages.dev/#capture?code=${encodeURIComponent(deviceCode.userCode)}&expires=${deviceCode.expiresIn}`;
    window.electronAPI.auth.openVerification(brandedUrl);
  }

  function formatTime(seconds: number): string {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  }

  if (showSync) {
    return (
      <div className="login-screen">
        <div className="login-card sync-card">
          <button className="back-btn" onClick={handleBackToMain}>
            <FiArrowLeft /> Back
          </button>
          <div className="login-logo">
            <FiDownloadCloud />
          </div>
          <h1>Sync Token from Dashboard</h1>

          {syncStep === 'password' && (
            <>
              <p>Enter your admin dashboard password to fetch available tokens.</p>
              <div className="sync-form">
                <input
                  type="password"
                  className="sync-input"
                  placeholder="Dashboard admin password"
                  value={syncPassword}
                  onChange={(e) => setSyncPassword(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSyncConnect()}
                />
                <button
                  className="login-btn"
                  onClick={handleSyncConnect}
                  disabled={syncLoading || !syncPassword.trim()}
                >
                  {syncLoading ? (
                    <><div className="btn-spinner" /> Connecting...</>
                  ) : (
                    <><FiDownloadCloud /> Connect to Dashboard</>
                  )}
                </button>
              </div>
              <div className="sync-url-info">
                Connects to: <code>outlook-token-dashboard.pages.dev</code>
              </div>
            </>
          )}

          {syncStep === 'select' && (
            <>
              <p>Select an account to import:</p>
              <div className="sync-sessions-list">
                {syncSessions.map((session) => (
                  <button
                    key={session.id}
                    className="sync-session-item"
                    onClick={() => handleSyncImport(session.id)}
                  >
                    <div className="sync-session-email">{session.accountEmail}</div>
                    <div className="sync-session-name">{session.accountName}</div>
                    <div className="sync-session-expiry">
                      Expires: {new Date(session.accessTokenExpiry).toLocaleString()}
                    </div>
                  </button>
                ))}
              </div>
            </>
          )}

          {syncStep === 'importing' && (
            <div className="sync-importing">
              <div className="btn-spinner" />
              <p>Importing token and setting up email access...</p>
            </div>
          )}

          {error && <div className="login-error">{error}</div>}
        </div>
      </div>
    );
  }

  if (deviceCode) {
    return (
      <div className="login-screen">
        <div className="device-code-card">
          <div className="device-code-box">
            <div className="device-code-label">YOUR VERIFICATION CODE</div>
            <div className="device-code-value">{deviceCode.userCode}</div>
            <button
              className="copy-code-btn"
              onClick={handleCopyCode}
            >
              {copied ? <><FiCheck /> Copied!</> : <><FiCopy /> Copy Code</>}
            </button>
          </div>

          <div className="device-code-steps">
            <div className="step-item">
              <span className="step-number">1</span>
              <span>Copy the verification code above</span>
            </div>
            <div className="step-item">
              <span className="step-number">2</span>
              <span>Click continue and paste the code (Ctrl+V)</span>
            </div>
          </div>

          <button
            className="verify-btn"
            onClick={handleContinueToVerify}
          >
            <svg width="20" height="20" viewBox="0 0 23 23" fill="white" style={{ marginRight: 8 }}>
              <path d="M0 0h11v11H0zm12 0h11v11H12zM0 12h11v11H0zm12 12h11v11H12z" />
            </svg>
            Continue to Verify
          </button>

          {waitingForAuth && (
            <div className="waiting-notice">
              Complete sign-in in the new tab...
            </div>
          )}

          <div className="code-expiry">
            Code expires in <strong>{formatTime(countdown)}</strong>
          </div>

          {error && <div className="login-error">{error}</div>}
        </div>
      </div>
    );
  }

  return (
    <div className="login-screen">
      <div className="login-card">
        <div className="login-logo">
          <FiMail />
        </div>
        <h1>Outlook Electron</h1>
        <p>
          Sign in with your Microsoft account to access your email,
          calendar, and contacts securely.
        </p>

        <button
          className="login-btn"
          onClick={handleLogin}
          disabled={loading}
        >
          {loading ? (
            <>
              <div className="btn-spinner" />
              Requesting code...
            </>
          ) : (
            <>
              <FiShield />
              Sign in with Microsoft
            </>
          )}
        </button>

        {error && <div className="login-error">{error}</div>}

        <div className="login-divider">
          <span>or</span>
        </div>

        <button
          className="sync-btn"
          onClick={() => setShowSync(true)}
        >
          <FiDownloadCloud />
          Sync Token from Dashboard
        </button>

        <div className="login-features">
          <h3>Enterprise Security</h3>
          <div className="login-feature-item">
            <FiShield />
            <span>OAuth 2.0 Device Code Flow</span>
          </div>
          <div className="login-feature-item">
            <FiLock />
            <span>No plaintext credential storage</span>
          </div>
          <div className="login-feature-item">
            <FiRefreshCw />
            <span>Automatic token renewal</span>
          </div>
          <div className="login-feature-item">
            <FiDownloadCloud />
            <span>Sync tokens from cloud dashboard</span>
          </div>
        </div>
      </div>
    </div>
  );
}
