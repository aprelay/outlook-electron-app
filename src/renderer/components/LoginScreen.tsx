import React, { useState, useEffect, useCallback } from 'react';
import { FiMail, FiShield, FiLock, FiRefreshCw, FiCopy, FiCheck } from 'react-icons/fi';
import type { DeviceCodeInfo } from '../types/electron';

interface LoginScreenProps {
  onLogin: () => Promise<void>;
}

export function LoginScreen({ onLogin }: LoginScreenProps): React.ReactElement {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deviceCode, setDeviceCode] = useState<DeviceCodeInfo | null>(null);
  const [copied, setCopied] = useState(false);
  const [countdown, setCountdown] = useState(0);
  const [waitingForAuth, setWaitingForAuth] = useState(false);

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

  function handleContinueToVerify(): void {
    if (!deviceCode) return;
    setWaitingForAuth(true);
    window.electronAPI.auth.openVerification(deviceCode.verificationUri);
  }

  function formatTime(seconds: number): string {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
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
            <FiShield />
            <span>Encrypted token storage via OS keychain</span>
          </div>
        </div>
      </div>
    </div>
  );
}
