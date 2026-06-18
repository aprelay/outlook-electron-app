import React, { useState } from 'react';
import type { TokenSession } from '../types';
import { formatRelativeTime, formatDateTime, getStatusColor, getTimeUntilExpiry } from './utils';

interface SessionsPanelProps {
  sessions: TokenSession[];
  onRevoke: (sessionId: string) => void;
  onRevokeAll: () => void;
}

export function SessionsPanel({
  sessions,
  onRevoke,
  onRevokeAll,
}: SessionsPanelProps): React.ReactElement {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [confirmRevoke, setConfirmRevoke] = useState<string | null>(null);
  const [confirmRevokeAll, setConfirmRevokeAll] = useState(false);
  const [filter, setFilter] = useState<'all' | 'active' | 'expired' | 'revoked'>('all');

  const filtered = filter === 'all'
    ? sessions
    : sessions.filter((s) => s.status === filter);

  const activeSessions = sessions.filter((s) => s.status === 'active');

  return (
    <div className="sessions-panel">
      <div className="sessions-toolbar">
        <div className="filter-group">
          {(['all', 'active', 'expired', 'revoked'] as const).map((f) => (
            <button
              key={f}
              className={`filter-btn ${filter === f ? 'active' : ''}`}
              onClick={() => setFilter(f)}
            >
              {f.charAt(0).toUpperCase() + f.slice(1)}
              <span className="filter-count">
                {f === 'all' ? sessions.length : sessions.filter((s) => s.status === f).length}
              </span>
            </button>
          ))}
        </div>
        {activeSessions.length > 0 && (
          <button
            className="btn-danger"
            onClick={() => setConfirmRevokeAll(true)}
          >
            Revoke All Active
          </button>
        )}
      </div>

      <div className="sessions-list">
        {filtered.map((session) => (
          <div
            key={session.id}
            className={`session-card ${expandedId === session.id ? 'expanded' : ''}`}
          >
            <div
              className="session-card-header"
              onClick={() =>
                setExpandedId(expandedId === session.id ? null : session.id)
              }
            >
              <div className="session-main-info">
                <div className="session-avatar">
                  {session.accountName.charAt(0).toUpperCase()}
                </div>
                <div>
                  <div className="session-name">{session.accountName}</div>
                  <div className="session-email">{session.accountEmail}</div>
                </div>
              </div>
              <div className="session-status-area">
                <span className={`status-badge ${getStatusColor(session.status)}`}>
                  {session.status.toUpperCase()}
                </span>
                <span className="session-last-active">
                  Last active: {formatRelativeTime(session.lastActivity)}
                </span>
              </div>
            </div>

            {expandedId === session.id && (
              <div className="session-details">
                <div className="detail-grid">
                  <DetailItem label="Session ID" value={session.id} />
                  <DetailItem label="Client ID" value={session.clientId} />
                  <DetailItem label="IP Address" value={session.ipAddress} />
                  <DetailItem label="Device" value={session.deviceInfo} />
                  <DetailItem label="Created" value={formatDateTime(session.createdAt)} />
                  <DetailItem label="Last Activity" value={formatDateTime(session.lastActivity)} />
                  <DetailItem
                    label="Access Token"
                    value={getTimeUntilExpiry(session.accessTokenExpiry)}
                    highlight={new Date(session.accessTokenExpiry).getTime() <= Date.now()}
                  />
                  <DetailItem
                    label="Refresh Token"
                    value={getTimeUntilExpiry(session.refreshTokenExpiry)}
                    highlight={new Date(session.refreshTokenExpiry).getTime() <= Date.now()}
                  />
                </div>

                <div className="scopes-section">
                  <span className="scopes-label">Granted Scopes:</span>
                  <div className="scopes-list">
                    {session.scopes.map((scope) => (
                      <span key={scope} className="scope-tag">
                        {scope}
                      </span>
                    ))}
                  </div>
                </div>

                {session.status === 'active' && (
                  <div className="session-actions">
                    {confirmRevoke === session.id ? (
                      <div className="confirm-inline">
                        <span>Revoke this session?</span>
                        <button
                          className="btn-danger-sm"
                          onClick={() => {
                            onRevoke(session.id);
                            setConfirmRevoke(null);
                          }}
                        >
                          Confirm Revoke
                        </button>
                        <button
                          className="btn-cancel-sm"
                          onClick={() => setConfirmRevoke(null)}
                        >
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <button
                        className="btn-danger-sm"
                        onClick={() => setConfirmRevoke(session.id)}
                      >
                        Revoke Session
                      </button>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        ))}

        {filtered.length === 0 && (
          <div className="sessions-empty">
            No {filter === 'all' ? '' : filter} sessions found
          </div>
        )}
      </div>

      {confirmRevokeAll && (
        <div className="modal-overlay" onClick={() => setConfirmRevokeAll(false)}>
          <div className="modal-dialog" onClick={(e) => e.stopPropagation()}>
            <h3>Revoke All Active Sessions</h3>
            <p>
              This will immediately revoke {activeSessions.length} active session(s).
              All users will need to re-authenticate. This action cannot be undone.
            </p>
            <div className="modal-actions">
              <button className="btn-cancel" onClick={() => setConfirmRevokeAll(false)}>
                Cancel
              </button>
              <button
                className="btn-danger"
                onClick={() => {
                  onRevokeAll();
                  setConfirmRevokeAll(false);
                }}
              >
                Revoke All
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function DetailItem({
  label,
  value,
  highlight,
}: {
  label: string;
  value: string;
  highlight?: boolean;
}): React.ReactElement {
  return (
    <div className="detail-item">
      <span className="detail-label">{label}</span>
      <span className={`detail-value ${highlight ? 'expired-text' : ''}`}>
        {value}
      </span>
    </div>
  );
}
