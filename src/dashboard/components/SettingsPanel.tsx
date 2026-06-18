import React, { useState } from 'react';

interface TokenPolicy {
  accessTokenTTL: number;
  refreshTokenTTL: number;
  maxConcurrentSessions: number;
  requireMFA: boolean;
  autoRevokeInactive: boolean;
  inactivityThresholdDays: number;
  allowedScopes: string[];
  ipWhitelist: string;
}

const DEFAULT_POLICY: TokenPolicy = {
  accessTokenTTL: 60,
  refreshTokenTTL: 90,
  maxConcurrentSessions: 5,
  requireMFA: false,
  autoRevokeInactive: true,
  inactivityThresholdDays: 30,
  allowedScopes: [
    'User.Read',
    'Mail.Read',
    'Mail.ReadWrite',
    'Mail.Send',
    'MailboxSettings.Read',
  ],
  ipWhitelist: '',
};

export function SettingsPanel(): React.ReactElement {
  const [policy, setPolicy] = useState<TokenPolicy>(DEFAULT_POLICY);
  const [saved, setSaved] = useState(false);

  function handleSave(): void {
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  }

  function toggleScope(scope: string): void {
    setPolicy((prev) => ({
      ...prev,
      allowedScopes: prev.allowedScopes.includes(scope)
        ? prev.allowedScopes.filter((s) => s !== scope)
        : [...prev.allowedScopes, scope],
    }));
  }

  const allScopes = [
    'User.Read',
    'Mail.Read',
    'Mail.ReadWrite',
    'Mail.Send',
    'MailboxSettings.Read',
    'MailboxSettings.ReadWrite',
    'Calendars.Read',
    'Calendars.ReadWrite',
    'Contacts.Read',
    'Contacts.ReadWrite',
  ];

  return (
    <div className="settings-panel">
      <div className="settings-section">
        <h3>Token Lifetime Policy</h3>
        <div className="settings-grid">
          <div className="setting-item">
            <label>Access Token TTL (minutes)</label>
            <input
              type="number"
              value={policy.accessTokenTTL}
              onChange={(e) =>
                setPolicy({ ...policy, accessTokenTTL: Number(e.target.value) })
              }
              min={5}
              max={1440}
            />
            <span className="setting-hint">Microsoft default: 60 minutes</span>
          </div>
          <div className="setting-item">
            <label>Refresh Token TTL (days)</label>
            <input
              type="number"
              value={policy.refreshTokenTTL}
              onChange={(e) =>
                setPolicy({ ...policy, refreshTokenTTL: Number(e.target.value) })
              }
              min={1}
              max={365}
            />
            <span className="setting-hint">Microsoft default: 90 days</span>
          </div>
          <div className="setting-item">
            <label>Max Concurrent Sessions</label>
            <input
              type="number"
              value={policy.maxConcurrentSessions}
              onChange={(e) =>
                setPolicy({ ...policy, maxConcurrentSessions: Number(e.target.value) })
              }
              min={1}
              max={50}
            />
          </div>
        </div>
      </div>

      <div className="settings-section">
        <h3>Security Settings</h3>
        <div className="settings-toggles">
          <div className="toggle-item">
            <div>
              <div className="toggle-label">Require Multi-Factor Authentication</div>
              <div className="toggle-desc">
                Enforce MFA for all OAuth 2.0 login flows
              </div>
            </div>
            <button
              className={`toggle-switch ${policy.requireMFA ? 'on' : ''}`}
              onClick={() => setPolicy({ ...policy, requireMFA: !policy.requireMFA })}
            >
              <span className="toggle-knob" />
            </button>
          </div>
          <div className="toggle-item">
            <div>
              <div className="toggle-label">Auto-Revoke Inactive Sessions</div>
              <div className="toggle-desc">
                Automatically revoke sessions after {policy.inactivityThresholdDays} days of inactivity
              </div>
            </div>
            <button
              className={`toggle-switch ${policy.autoRevokeInactive ? 'on' : ''}`}
              onClick={() =>
                setPolicy({ ...policy, autoRevokeInactive: !policy.autoRevokeInactive })
              }
            >
              <span className="toggle-knob" />
            </button>
          </div>
        </div>
        {policy.autoRevokeInactive && (
          <div className="setting-item" style={{ marginTop: 12, maxWidth: 300 }}>
            <label>Inactivity Threshold (days)</label>
            <input
              type="number"
              value={policy.inactivityThresholdDays}
              onChange={(e) =>
                setPolicy({ ...policy, inactivityThresholdDays: Number(e.target.value) })
              }
              min={1}
              max={365}
            />
          </div>
        )}
      </div>

      <div className="settings-section">
        <h3>Allowed Scopes</h3>
        <div className="scopes-grid">
          {allScopes.map((scope) => (
            <label key={scope} className="scope-checkbox">
              <input
                type="checkbox"
                checked={policy.allowedScopes.includes(scope)}
                onChange={() => toggleScope(scope)}
              />
              <span>{scope}</span>
            </label>
          ))}
        </div>
      </div>

      <div className="settings-section">
        <h3>IP Allowlist</h3>
        <div className="setting-item">
          <label>Allowed IP Ranges (one per line, CIDR notation)</label>
          <textarea
            value={policy.ipWhitelist}
            onChange={(e) => setPolicy({ ...policy, ipWhitelist: e.target.value })}
            placeholder={"192.168.1.0/24\n10.0.0.0/8"}
            rows={4}
          />
          <span className="setting-hint">Leave empty to allow all IPs</span>
        </div>
      </div>

      <div className="settings-footer">
        <button className="btn-primary" onClick={handleSave}>
          Save Policy
        </button>
        {saved && <span className="save-success">Policy saved successfully</span>}
      </div>
    </div>
  );
}
