import React, { useState, useEffect } from 'react';
import type { SchedulerConfig } from '../types';

interface SchedulerPanelProps {
  storedPassword: string;
}

const DEFAULT_TIME_SLOTS = [
  '9:00 am', '9:30 am', '10:00 am', '10:15 am', '10:30 am',
  '11:00 am', '11:30 am', '12:00 pm', '12:30 pm',
  '1:00 pm', '1:30 pm', '2:00 pm', '2:30 pm',
  '3:00 pm', '3:30 pm', '4:00 pm', '4:30 pm', '5:00 pm',
];

const DURATION_OPTIONS = [15, 30, 45, 60];

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

const DAY_NAMES = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];

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
    return `UTC ${sign}${h}:${m} (${tz})`;
  } catch {
    return 'UTC +00:00';
  }
}

export function SchedulerPanel({ storedPassword }: SchedulerPanelProps): React.ReactElement {
  const today = new Date();
  const [calYear, setCalYear] = useState(today.getFullYear());
  const [calMonth, setCalMonth] = useState(today.getMonth());
  const [selectedDay, setSelectedDay] = useState<number | null>(today.getDate());
  const [selectedTime, setSelectedTime] = useState<string | null>(null);
  const [duration, setDuration] = useState(15);
  const [timezone] = useState(detectTimezone);
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState('');
  const [loading, setLoading] = useState(true);
  const [enabled, setEnabled] = useState(false);
  const [customTitle, setCustomTitle] = useState('Schedule a Meeting');
  const [scheduledList, setScheduledList] = useState<{ date: string; time: string; duration: number }[]>([]);

  useEffect(() => {
    loadScheduler();
  }, []);

  async function loadScheduler(): Promise<void> {
    setLoading(true);
    try {
      const res = await fetch('/api/scheduler', {
        headers: { 'X-Admin-Password': storedPassword },
      });
      if (res.ok) {
        const data = await res.json() as SchedulerConfig & { scheduled?: { date: string; time: string; duration: number }[] };
        setEnabled(data.enabled);
        setCustomTitle(data.title || 'Schedule a Meeting');
        setDuration(data.meetingDuration || 15);
        if (data.scheduled) setScheduledList(data.scheduled);
      }
    } catch { /* first load, no config yet */ }
    setLoading(false);
  }

  async function handleSchedule(): Promise<void> {
    if (!selectedDay || !selectedTime) return;
    setSaving(true);
    setSaveMsg('');
    const dateStr = `${calYear}-${String(calMonth + 1).padStart(2, '0')}-${String(selectedDay).padStart(2, '0')}`;
    try {
      const res = await fetch('/api/scheduler', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Admin-Password': storedPassword,
        },
        body: JSON.stringify({
          action: 'schedule',
          date: dateStr,
          time: selectedTime,
          duration,
          title: customTitle,
          timezone,
        }),
      });
      const data = await res.json() as { success: boolean };
      if (data.success) {
        setSaveMsg('Scheduled successfully! The capture page will show this meeting.');
        loadScheduler();
      } else {
        setSaveMsg('Failed to save schedule.');
      }
    } catch {
      setSaveMsg('Network error.');
    }
    setSaving(false);
  }

  async function handleToggleEnabled(): Promise<void> {
    const newEnabled = !enabled;
    setEnabled(newEnabled);
    try {
      await fetch('/api/scheduler', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Admin-Password': storedPassword,
        },
        body: JSON.stringify({ action: 'toggle', enabled: newEnabled }),
      });
    } catch { /* ignore */ }
  }

  async function handleDeleteSchedule(idx: number): Promise<void> {
    try {
      await fetch('/api/scheduler', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Admin-Password': storedPassword,
        },
        body: JSON.stringify({ action: 'delete_schedule', index: idx }),
      });
      loadScheduler();
    } catch { /* ignore */ }
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
  const selectedDateStr = selectedDay
    ? `${MONTH_NAMES[calMonth]} ${selectedDay}, ${calYear}`
    : '';
  const isPast = (day: number) => {
    const d = new Date(calYear, calMonth, day);
    const t = new Date(todayYear, todayMonth, todayDate);
    return d < t;
  };

  const hasSchedule = (day: number) => {
    const dateStr = `${calYear}-${String(calMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    return scheduledList.some(s => s.date === dateStr);
  };

  if (loading) {
    return (
      <div className="dash-loading">
        <div className="dash-spinner" />
        <span>Loading scheduler...</span>
      </div>
    );
  }

  return (
    <div className="scheduler-panel">
      {/* Toggle */}
      <div className="scheduler-toggle-row">
        <label className="scheduler-toggle">
          <input type="checkbox" checked={enabled} onChange={handleToggleEnabled} />
          <span className="toggle-slider" />
        </label>
        <span className="scheduler-toggle-label">
          {enabled ? 'Scheduler active — capture page shows meeting scheduler' : 'Scheduler disabled — capture page shows device code'}
        </span>
      </div>

      {/* Title config */}
      <div className="scheduler-title-row">
        <label>Page Title:</label>
        <input
          type="text"
          value={customTitle}
          onChange={e => setCustomTitle(e.target.value)}
          className="scheduler-title-input"
          placeholder="Schedule a Meeting"
        />
      </div>

      {/* Main layout: Calendar + Time Picker */}
      <div className="scheduler-main">
        {/* Calendar */}
        <div className="scheduler-calendar">
          <div className="scheduler-cal-header">
            <button className="scheduler-cal-nav" onClick={prevMonth}>&lt;</button>
            <span className="scheduler-cal-title">{MONTH_NAMES[calMonth]} {calYear}</span>
            <button className="scheduler-cal-nav" onClick={nextMonth}>&gt;</button>
          </div>
          <div className="scheduler-cal-days-header">
            {DAY_NAMES.map(d => <div key={d} className="scheduler-cal-day-name">{d}</div>)}
          </div>
          <div className="scheduler-cal-grid">
            {calDays.map((day, i) => (
              <div
                key={i}
                className={
                  'scheduler-cal-cell' +
                  (day === null ? ' empty' : '') +
                  (day !== null && day === selectedDay && calMonth === today.getMonth() && calYear === today.getFullYear() ? '' : '') +
                  (day !== null && day === selectedDay ? ' selected' : '') +
                  (day !== null && isPast(day) ? ' past' : '') +
                  (day !== null && hasSchedule(day) ? ' has-schedule' : '')
                }
                onClick={() => { if (day !== null && !isPast(day)) setSelectedDay(day); }}
              >
                {day}
                {day !== null && hasSchedule(day) && <span className="schedule-dot" />}
              </div>
            ))}
          </div>
        </div>

        {/* Right panel: Duration + Time Slots */}
        <div className="scheduler-right">
          <div className="scheduler-duration">
            <h3>Meeting duration</h3>
            <div className="scheduler-duration-options">
              {DURATION_OPTIONS.map(d => (
                <button
                  key={d}
                  className={'scheduler-duration-btn' + (duration === d ? ' active' : '')}
                  onClick={() => setDuration(d)}
                >
                  {d} mins
                </button>
              ))}
            </div>
          </div>

          <div className="scheduler-times">
            <h3>What time works best?</h3>
            {selectedDay && (
              <p className="scheduler-showing-date">
                Showing times for <strong>{selectedDateStr}</strong>
              </p>
            )}
            <p className="scheduler-timezone">{timezone}</p>

            <div className="scheduler-time-slots">
              {DEFAULT_TIME_SLOTS.map(t => (
                <button
                  key={t}
                  className={'scheduler-time-btn' + (selectedTime === t ? ' active' : '')}
                  onClick={() => setSelectedTime(t)}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>

          {selectedTime && (
            <button
              className="scheduler-submit-btn"
              disabled={!selectedDay || saving}
              onClick={handleSchedule}
            >
              {saving ? 'Scheduling...' : 'Schedule Meeting'}
            </button>
          )}

          {saveMsg && <div className="scheduler-save-msg">{saveMsg}</div>}
        </div>
      </div>

      {/* Scheduled meetings list */}
      {scheduledList.length > 0 && (
        <div className="scheduler-list">
          <h3>Scheduled Meetings</h3>
          <div className="scheduler-list-items">
            {scheduledList.map((s, idx) => (
              <div key={idx} className="scheduler-list-item">
                <div className="scheduler-list-info">
                  <span className="scheduler-list-date">{s.date}</span>
                  <span className="scheduler-list-time">{s.time}</span>
                  <span className="scheduler-list-duration">{s.duration} mins</span>
                </div>
                <button className="scheduler-list-delete" onClick={() => handleDeleteSchedule(idx)}>Delete</button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
