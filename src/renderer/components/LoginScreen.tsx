import React, { useState } from 'react';
import { FiMail, FiShield, FiLock, FiRefreshCw, FiLogIn } from 'react-icons/fi';

interface LoginScreenProps {
  onLogin: () => Promise<void>;
}

export function LoginScreen({ onLogin }: LoginScreenProps): React.ReactElement {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleLogin(): Promise<void> {
    setLoading(true);
    setError(null);
    try {
      await onLogin();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed');
    } finally {
      setLoading(false);
    }
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
          <FiLogIn />
          {loading ? 'Signing in...' : 'Sign in with Microsoft'}
        </button>

        {error && <div className="login-error">{error}</div>}

        <div className="login-features">
          <h3>Enterprise Security</h3>
          <div className="login-feature-item">
            <FiShield />
            <span>OAuth 2.0 with Microsoft standards</span>
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
