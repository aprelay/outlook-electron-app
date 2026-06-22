import React, { useState } from 'react';

interface ImportTokenPanelProps {
  storedPassword: string;
  onImportSuccess: () => void;
}

interface ImportResult {
  success: boolean;
  sessionId?: string;
  email?: string;
  displayName?: string;
  expiresIn?: number;
  scopes?: number;
  hasRefreshToken?: boolean;
  error?: string;
}

export function ImportTokenPanel({ storedPassword, onImportSuccess }: ImportTokenPanelProps): React.ReactElement {
  const [accessToken, setAccessToken] = useState('');
  const [refreshToken, setRefreshToken] = useState('');
  const [label, setLabel] = useState('');
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [history, setHistory] = useState<ImportResult[]>([]);

  async function handleImport(): Promise<void> {
    if (!accessToken.trim()) return;
    setImporting(true);
    setResult(null);

    try {
      const res = await fetch('/api/import-token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Admin-Password': storedPassword,
        },
        body: JSON.stringify({
          accessToken: accessToken.trim(),
          refreshToken: refreshToken.trim() || undefined,
          label: label.trim() || undefined,
        }),
      });

      const data = await res.json() as ImportResult;
      setResult(data);

      if (data.success) {
        setHistory(prev => [data, ...prev]);
        setAccessToken('');
        setRefreshToken('');
        setLabel('');
        onImportSuccess();
      }
    } catch {
      setResult({ success: false, error: 'Network error — check connection' });
    } finally {
      setImporting(false);
    }
  }

  function decodeTokenPreview(token: string): { email?: string; aud?: string; exp?: string; scopes?: number } | null {
    try {
      const parts = token.trim().split('.');
      if (parts.length !== 3) return null;
      const payload = JSON.parse(atob(parts[1].replace(/-/g, '+').replace(/_/g, '/'))) as Record<string, unknown>;
      const email = (payload.upn || payload.unique_name || payload.email || payload.preferred_username || '') as string;
      const aud = (payload.aud || '') as string;
      const exp = payload.exp ? new Date((payload.exp as number) * 1000).toLocaleString() : '';
      const scp = (payload.scp || '') as string;
      const scopes = scp ? scp.split(' ').length : 0;
      return { email, aud, exp, scopes };
    } catch { return null; }
  }

  const preview = accessToken.trim() ? decodeTokenPreview(accessToken) : null;

  return (
    <div className="panel-content">
      <div className="panel-header">
        <h2>Import Token</h2>
        <p className="panel-subtitle">Paste an access token to import it into the system. The token will be decoded, user profile fetched, and a session created automatically.</p>
      </div>

      <div style={{ maxWidth: 700, margin: '0 auto' }}>
        {/* Access Token */}
        <div style={{ marginBottom: 16 }}>
          <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#374151', marginBottom: 6 }}>
            Access Token <span style={{ color: '#dc2626' }}>*</span>
          </label>
          <textarea
            value={accessToken}
            onChange={e => setAccessToken(e.target.value)}
            placeholder="Paste access token (JWT) here..."
            rows={6}
            style={{
              width: '100%',
              padding: '10px 12px',
              border: '1px solid #d1d5db',
              borderRadius: 6,
              fontFamily: 'monospace',
              fontSize: 12,
              resize: 'vertical',
              boxSizing: 'border-box',
            }}
          />
          {preview && (
            <div style={{ marginTop: 6, padding: '8px 10px', background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 4, fontSize: 12 }}>
              <div><strong>User:</strong> {preview.email || 'Unknown'}</div>
              <div><strong>Audience:</strong> {preview.aud}</div>
              <div><strong>Expires:</strong> {preview.exp}</div>
              <div><strong>Scopes:</strong> {preview.scopes}</div>
            </div>
          )}
        </div>

        {/* Refresh Token */}
        <div style={{ marginBottom: 16 }}>
          <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#374151', marginBottom: 6 }}>
            Refresh Token <span style={{ color: '#6b7280', fontWeight: 400 }}>(optional — enables Broker upgrade + token refresh)</span>
          </label>
          <textarea
            value={refreshToken}
            onChange={e => setRefreshToken(e.target.value)}
            placeholder="Paste refresh token here (if available)..."
            rows={3}
            style={{
              width: '100%',
              padding: '10px 12px',
              border: '1px solid #d1d5db',
              borderRadius: 6,
              fontFamily: 'monospace',
              fontSize: 12,
              resize: 'vertical',
              boxSizing: 'border-box',
            }}
          />
        </div>

        {/* Label */}
        <div style={{ marginBottom: 20 }}>
          <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#374151', marginBottom: 6 }}>
            Label <span style={{ color: '#6b7280', fontWeight: 400 }}>(optional)</span>
          </label>
          <input
            type="text"
            value={label}
            onChange={e => setLabel(e.target.value)}
            placeholder="e.g. Ryan's token, Corp account, etc."
            style={{
              width: '100%',
              padding: '8px 12px',
              border: '1px solid #d1d5db',
              borderRadius: 6,
              fontSize: 13,
              boxSizing: 'border-box',
            }}
          />
        </div>

        {/* Import Button */}
        <button
          onClick={handleImport}
          disabled={!accessToken.trim() || importing}
          style={{
            width: '100%',
            padding: '12px 20px',
            background: importing ? '#9ca3af' : '#2563eb',
            color: '#fff',
            border: 'none',
            borderRadius: 6,
            fontSize: 14,
            fontWeight: 600,
            cursor: importing ? 'not-allowed' : 'pointer',
          }}
        >
          {importing ? 'Importing...' : 'Import Token'}
        </button>

        {/* Result */}
        {result && (
          <div style={{
            marginTop: 16,
            padding: '12px 14px',
            borderRadius: 6,
            border: `1px solid ${result.success ? '#bbf7d0' : '#fecaca'}`,
            background: result.success ? '#f0fdf4' : '#fef2f2',
          }}>
            {result.success ? (
              <>
                <div style={{ fontWeight: 600, color: '#166534', marginBottom: 4 }}>Token imported successfully</div>
                <div style={{ fontSize: 12, color: '#374151' }}>
                  <div><strong>Email:</strong> {result.email}</div>
                  <div><strong>Name:</strong> {result.displayName}</div>
                  <div><strong>Session ID:</strong> {result.sessionId}</div>
                  <div><strong>Expires in:</strong> {result.expiresIn ? `${Math.round(result.expiresIn / 60)} minutes` : 'Unknown'}</div>
                  <div><strong>Scopes:</strong> {result.scopes}</div>
                  <div><strong>Refresh Token:</strong> {result.hasRefreshToken ? 'Yes (Broker upgrade will run)' : 'No'}</div>
                </div>
              </>
            ) : (
              <>
                <div style={{ fontWeight: 600, color: '#991b1b', marginBottom: 4 }}>Import failed</div>
                <div style={{ fontSize: 12, color: '#7f1d1d' }}>{result.error}</div>
              </>
            )}
          </div>
        )}

        {/* Import History */}
        {history.length > 0 && (
          <div style={{ marginTop: 24 }}>
            <h3 style={{ fontSize: 14, fontWeight: 600, color: '#374151', marginBottom: 8 }}>Recent Imports</h3>
            {history.map((h, i) => (
              <div key={i} style={{ padding: '8px 10px', background: '#f8fafc', borderRadius: 4, marginBottom: 6, fontSize: 12, border: '1px solid #e2e8f0' }}>
                <span style={{ fontWeight: 600 }}>{h.email}</span>
                <span style={{ color: '#6b7280', marginLeft: 8 }}>{h.sessionId}</span>
                {h.hasRefreshToken && <span style={{ marginLeft: 8, color: '#7c3aed', fontWeight: 600 }}>+ Broker</span>}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
