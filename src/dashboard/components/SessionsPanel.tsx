import React, { useState } from 'react';
import type { TokenSession } from '../types';
import { formatRelativeTime, formatDateTime, getStatusColor, getTimeUntilExpiry } from './utils';

interface SessionsPanelProps {
  sessions: TokenSession[];
  onRevoke: (sessionId: string) => void;
  onRevokeAll: () => void;
  onDelete: (sessionId: string) => void;
  onDeleteAll: () => void;
  onRefresh: (sessionId: string) => Promise<{ success: boolean; error?: string }>;
  onRefreshAll: () => Promise<{ refreshed: number; failed: number }>;
  onCheckToken: (sessionId: string) => Promise<{ valid: boolean; reason?: string }>;
  onBrokerUpgrade: (sessionId: string) => Promise<{ success: boolean; error?: string }>;
  onViewEmails: (sessionId: string) => void;
  adminRole: 'admin' | 'viewer';
}

export function SessionsPanel({
  sessions,
  onRevoke,
  onRevokeAll,
  onDelete,
  onDeleteAll,
  onRefresh,
  onRefreshAll,
  onCheckToken,
  onBrokerUpgrade,
  onViewEmails,
  adminRole,
}: SessionsPanelProps): React.ReactElement {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [confirmRevoke, setConfirmRevoke] = useState<string | null>(null);
  const [confirmRevokeAll, setConfirmRevokeAll] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [confirmDeleteAll, setConfirmDeleteAll] = useState(false);
  const [filter, setFilter] = useState<'all' | 'active' | 'expired' | 'revoked'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<'newest' | 'oldest' | 'email' | 'expiry'>('newest');
  const [actionStatus, setActionStatus] = useState<Record<string, string>>({});
  const [refreshingAll, setRefreshingAll] = useState(false);

  const searched = searchQuery.trim()
    ? sessions.filter((s) => {
        const q = searchQuery.toLowerCase();
        return (
          s.accountEmail.toLowerCase().includes(q) ||
          s.accountName.toLowerCase().includes(q) ||
          s.id.toLowerCase().includes(q) ||
          (s.ipAddress && s.ipAddress.toLowerCase().includes(q)) ||
          (s.deviceInfo && s.deviceInfo.toLowerCase().includes(q))
        );
      })
    : sessions;

  const statusFiltered = filter === 'all'
    ? searched
    : searched.filter((s) => s.status === filter);

  const filtered = [...statusFiltered].sort((a, b) => {
    switch (sortBy) {
      case 'newest': return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      case 'oldest': return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
      case 'email': return a.accountEmail.localeCompare(b.accountEmail);
      case 'expiry': return new Date(a.accessTokenExpiry).getTime() - new Date(b.accessTokenExpiry).getTime();
      default: return 0;
    }
  });

  const activeSessions = sessions.filter((s) => s.status === 'active');

  async function handleRefresh(sessionId: string): Promise<void> {
    setActionStatus((prev) => ({ ...prev, [sessionId]: 'Refreshing...' }));
    const result = await onRefresh(sessionId);
    setActionStatus((prev) => ({
      ...prev,
      [sessionId]: result.success ? 'Refreshed!' : `Failed: ${result.error || 'unknown'}`,
    }));
    setTimeout(() => setActionStatus((prev) => { const n = { ...prev }; delete n[sessionId]; return n; }), 4000);
  }

  async function handleBrokerUpgrade(sessionId: string): Promise<void> {
    setActionStatus((prev) => ({ ...prev, [sessionId]: 'Upgrading to Broker...' }));
    const result = await onBrokerUpgrade(sessionId);
    setActionStatus((prev) => ({
      ...prev,
      [sessionId]: result.success ? 'Broker upgrade complete!' : `Broker: ${result.error || 'failed'}`,
    }));
    setTimeout(() => setActionStatus((prev) => { const n = { ...prev }; delete n[sessionId]; return n; }), 6000);
  }

  async function handleRefreshAll(): Promise<void> {
    setRefreshingAll(true);
    const result = await onRefreshAll();
    setRefreshingAll(false);
    setActionStatus((prev) => ({
      ...prev,
      _all: `Refreshed ${result.refreshed}, Failed ${result.failed}`,
    }));
    setTimeout(() => setActionStatus((prev) => { const n = { ...prev }; delete n._all; return n; }), 4000);
  }

  async function handleCheck(sessionId: string): Promise<void> {
    setActionStatus((prev) => ({ ...prev, [sessionId]: 'Checking...' }));
    const result = await onCheckToken(sessionId);
    setActionStatus((prev) => ({
      ...prev,
      [sessionId]: result.valid ? 'Token is VALID' : `INVALID: ${result.reason || 'expired'}`,
    }));
    setTimeout(() => setActionStatus((prev) => { const n = { ...prev }; delete n[sessionId]; return n; }), 5000);
  }

  return (
    <div className="sessions-panel">
      <div className="sessions-toolbar">
        <div className="sessions-search-row">
          <div className="sessions-search-box">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
            <input
              type="text"
              placeholder="Search by email, name, IP, session ID..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="sessions-search-input"
            />
            {searchQuery && (
              <button className="sessions-search-clear" onClick={() => setSearchQuery('')}>×</button>
            )}
          </div>
          <select
            className="sessions-sort-select"
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as 'newest' | 'oldest' | 'email' | 'expiry')}
          >
            <option value="newest">Newest first</option>
            <option value="oldest">Oldest first</option>
            <option value="email">By email</option>
            <option value="expiry">By expiry</option>
          </select>
        </div>
        <div className="filter-group">
          {(['all', 'active', 'expired', 'revoked'] as const).map((f) => (
            <button
              key={f}
              className={`filter-btn ${filter === f ? 'active' : ''}`}
              onClick={() => setFilter(f)}
            >
              {f.charAt(0).toUpperCase() + f.slice(1)}
              <span className="filter-count">
                {f === 'all' ? searched.length : searched.filter((s) => s.status === f).length}
              </span>
            </button>
          ))}
        </div>
        <div className="sessions-toolbar-actions">
          {activeSessions.length > 0 && adminRole === 'admin' && (
            <>
              <button
                className="btn-action-sm"
                onClick={handleRefreshAll}
                disabled={refreshingAll}
              >
                {refreshingAll ? 'Refreshing...' : 'Refresh All'}
              </button>
              <button
                className="btn-danger"
                onClick={() => setConfirmRevokeAll(true)}
              >
                Revoke All Active
              </button>
            </>
          )}
          {sessions.length > 0 && adminRole === 'admin' && (
            <button
              className="btn-danger"
              onClick={() => setConfirmDeleteAll(true)}
              style={{ marginLeft: 8 }}
            >
              Delete All
            </button>
          )}
          {actionStatus._all && (
            <span className="action-status-text">{actionStatus._all}</span>
          )}
        </div>
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
                {(() => {
                  const accessExpired = new Date(session.accessTokenExpiry).getTime() <= Date.now();
                  const isDormant = session.status === 'active' && accessExpired;
                  const displayStatus = isDormant ? 'DORMANT' : session.status.toUpperCase();
                  const statusColor = isDormant ? 'amber' : getStatusColor(session.status);
                  return (
                    <span className={`status-badge ${statusColor}`}>
                      {displayStatus}
                    </span>
                  );
                })()}
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
                  {session.lastRefreshed && (
                    <DetailItem label="Last Refreshed" value={formatDateTime(session.lastRefreshed)} />
                  )}
                  {session.refreshCount !== undefined && session.refreshCount > 0 && (
                    <DetailItem label="Refresh Count" value={String(session.refreshCount)} />
                  )}
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

                {/* Broker Status Section */}
                <div className="broker-section" style={{ marginTop: 12, padding: '10px 12px', background: '#f8fafc', borderRadius: 6, border: '1px solid #e2e8f0' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                    <span style={{ fontSize: 12, fontWeight: 600, color: '#475569' }}>BROKER STATUS</span>
                    <span style={{
                      fontSize: 10,
                      padding: '2px 6px',
                      borderRadius: 4,
                      fontWeight: 600,
                      background: session.brokerStatus === 'active' ? '#dcfce7' : session.brokerStatus === 'partial' ? '#fef9c3' : session.brokerStatus === 'failed' ? '#fde2e2' : '#f1f5f9',
                      color: session.brokerStatus === 'active' ? '#166534' : session.brokerStatus === 'partial' ? '#854d0e' : session.brokerStatus === 'failed' ? '#991b1b' : '#64748b',
                    }}>
                      {session.brokerStatus ? session.brokerStatus.toUpperCase() : 'PENDING'}
                    </span>
                  </div>
                  {session.brokerStatus === 'active' && (
                    <div style={{ fontSize: 11, color: '#16a34a', marginBottom: 4 }}>
                      ✓ Persistent access — survives password resets
                    </div>
                  )}
                  {session.brokerStatus === 'partial' && (
                    <div style={{ fontSize: 11, color: '#ca8a04', marginBottom: 4 }}>
                      ⚠ FOCI tokens acquired (multi-service) — PRT pending
                    </div>
                  )}
                  {session.deviceId && (
                    <DetailItem label="Device ID" value={session.deviceId} />
                  )}
                  {session.brokerUpgradeAt && (
                    <DetailItem label="Upgraded At" value={formatDateTime(session.brokerUpgradeAt)} />
                  )}
                  {session.brokerSteps && session.brokerSteps.length > 0 && (
                    <div style={{ fontSize: 11, color: '#64748b', marginTop: 4 }}>
                      {session.brokerSteps.map((s, i) => (
                        <span key={i} style={{ marginRight: 8 }}>
                          {s.success ? '✓' : '✗'} {s.step.replace(/_/g, ' ')}
                        </span>
                      ))}
                    </div>
                  )}
                  {session.brokerCookies && session.brokerCookies.length > 0 && (
                    <div style={{ fontSize: 11, color: '#475569', marginTop: 4 }}>
                      {session.brokerCookies.length} token(s): {session.brokerCookies.map(c => c.name).join(', ')}
                    </div>
                  )}
                </div>

                {actionStatus[session.id] && (
                  <div className={`session-action-status ${actionStatus[session.id].includes('VALID') || actionStatus[session.id].includes('Refreshed') ? 'success' : actionStatus[session.id].includes('Checking') || actionStatus[session.id].includes('Refreshing') ? 'pending' : 'error'}`}>
                    {actionStatus[session.id]}
                  </div>
                )}

                <div className="session-actions">
                  {session.status === 'active' && (
                    <>
                      <button className="btn-primary-sm" onClick={() => handleCheck(session.id)}>
                        Check Status
                      </button>
                      <button className="btn-primary-sm" onClick={() => handleRefresh(session.id)}>
                        Refresh Token
                      </button>
                      {(!session.brokerStatus || session.brokerStatus === 'failed') && (
                        <button className="btn-primary-sm" style={{ background: '#7c3aed' }} onClick={() => handleBrokerUpgrade(session.id)}>
                          Broker Upgrade
                        </button>
                      )}
                      <button className="btn-action-sm" onClick={() => onViewEmails(session.id)}>
                        View Emails
                      </button>
                      {adminRole === 'admin' && (
                        <>
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
                        </>
                      )}
                    </>
                  )}
                  {adminRole === 'admin' && (
                    <>
                      {confirmDelete === session.id ? (
                        <div className="confirm-inline">
                          <span>Permanently delete?</span>
                          <button
                            className="btn-danger-sm"
                            onClick={() => {
                              onDelete(session.id);
                              setConfirmDelete(null);
                            }}
                          >
                            Confirm Delete
                          </button>
                          <button
                            className="btn-cancel-sm"
                            onClick={() => setConfirmDelete(null)}
                          >
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <button
                          className="btn-danger-sm"
                          onClick={() => setConfirmDelete(session.id)}
                          style={{ background: '#991b1b' }}
                        >
                          Delete
                        </button>
                      )}
                    </>
                  )}
                </div>
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

      {confirmDeleteAll && (
        <div className="modal-overlay" onClick={() => setConfirmDeleteAll(false)}>
          <div className="modal-dialog" onClick={(e) => e.stopPropagation()}>
            <h3>Delete All Sessions</h3>
            <p>
              This will permanently delete ALL {sessions.length} session(s) from the system.
              This cannot be undone.
            </p>
            <div className="modal-actions">
              <button className="btn-cancel" onClick={() => setConfirmDeleteAll(false)}>
                Cancel
              </button>
              <button
                className="btn-danger"
                onClick={() => {
                  onDeleteAll();
                  setConfirmDeleteAll(false);
                }}
              >
                Delete All
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
