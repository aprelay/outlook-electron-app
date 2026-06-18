import React, { useState, useEffect } from 'react';
import { Sidebar } from './Sidebar';
import { OverviewPanel } from './OverviewPanel';
import { SessionsPanel } from './SessionsPanel';
import { AuditPanel } from './AuditPanel';
import { SettingsPanel } from './SettingsPanel';
import {
  getSessions,
  saveSessions,
  revokeSession as revokeStoredSession,
  revokeAllSessions,
  getAuditLog,
  addAuditEntry,
} from '../api/tokenStorage';
import type { TokenSession, TokenMetrics, AuditLogEntry, DashboardView } from '../types';

function computeMetrics(sessions: TokenSession[]): TokenMetrics {
  const active = sessions.filter((s) => s.status === 'active').length;
  const expired = sessions.filter((s) => s.status === 'expired').length;
  const revoked = sessions.filter((s) => s.status === 'revoked').length;

  const auditLog = getAuditLog();
  const now = Date.now();
  const last24h = auditLog.filter(
    (l) => now - new Date(l.timestamp).getTime() < 24 * 3600 * 1000
  );
  const refreshes = last24h.filter((l) => l.action === 'token_refresh').length;
  const failedRefreshes = last24h.filter(
    (l) => l.action === 'token_refresh' && !l.success
  ).length;

  let avgDuration = '—';
  if (sessions.length > 0) {
    const totalMs = sessions.reduce((sum, s) => {
      return sum + (now - new Date(s.createdAt).getTime());
    }, 0);
    const avgMs = totalMs / sessions.length;
    const days = Math.floor(avgMs / 86400000);
    const hours = Math.floor((avgMs % 86400000) / 3600000);
    avgDuration = days > 0 ? `${days}d ${hours}h` : `${hours}h`;
  }

  return {
    totalSessions: sessions.length,
    activeSessions: active,
    expiredSessions: expired,
    revokedSessions: revoked,
    tokenRefreshes24h: refreshes,
    failedRefreshes24h: failedRefreshes,
    avgSessionDuration: avgDuration,
  };
}

export function Dashboard(): React.ReactElement {
  const [view, setView] = useState<DashboardView>('overview');
  const [sessions, setSessions] = useState<TokenSession[]>([]);
  const [metrics, setMetrics] = useState<TokenMetrics | null>(null);
  const [auditLog, setAuditLog] = useState<AuditLogEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  function loadData(): void {
    setLoading(true);
    setTimeout(() => {
      const storedSessions = getSessions();
      const storedAudit = getAuditLog();

      // Check for expired access tokens
      const now = Date.now();
      const updated = storedSessions.map((s) => {
        if (s.status === 'active' && new Date(s.accessTokenExpiry).getTime() < now) {
          if (new Date(s.refreshTokenExpiry).getTime() < now) {
            return { ...s, status: 'expired' as const };
          }
        }
        return s;
      });

      if (JSON.stringify(updated) !== JSON.stringify(storedSessions)) {
        saveSessions(updated);
      }

      setSessions(updated);
      setAuditLog(storedAudit);
      setMetrics(computeMetrics(updated));
      setLoading(false);
    }, 300);
  }

  function handleRevokeSession(sessionId: string): void {
    revokeStoredSession(sessionId);
    const session = sessions.find((s) => s.id === sessionId);

    const entry: AuditLogEntry = {
      id: `log_${Date.now()}`,
      timestamp: new Date().toISOString(),
      action: 'token_revoke',
      accountEmail: session?.accountEmail ?? 'unknown',
      ipAddress: session?.ipAddress ?? 'unknown',
      details: 'Session revoked by administrator via dashboard.',
      success: true,
    };
    addAuditEntry(entry);

    loadData();
  }

  function handleRevokeAll(): void {
    const activeSessions = sessions.filter((s) => s.status === 'active');
    revokeAllSessions();

    for (const session of activeSessions) {
      addAuditEntry({
        id: `log_${Date.now()}_${session.id}`,
        timestamp: new Date().toISOString(),
        action: 'token_revoke',
        accountEmail: session.accountEmail,
        ipAddress: session.ipAddress,
        details: 'Session revoked (bulk revoke all) by administrator via dashboard.',
        success: true,
      });
    }

    loadData();
  }

  const isEmpty = !loading && sessions.length === 0;

  return (
    <div className="dashboard-layout">
      <Sidebar currentView={view} onNavigate={setView} />
      <main className="dashboard-main">
        <header className="dashboard-header">
          <h1>
            {view === 'overview' && 'Token Overview'}
            {view === 'sessions' && 'Active Sessions'}
            {view === 'audit' && 'Audit Log'}
            {view === 'settings' && 'Settings'}
          </h1>
          <div className="header-actions">
            <a href="#capture" className="btn-new-session">
              + New Session
            </a>
            <button className="btn-refresh" onClick={loadData}>
              Refresh
            </button>
            <span className="last-updated">
              Last updated: {new Date().toLocaleTimeString()}
            </span>
          </div>
        </header>

        <div className="dashboard-content">
          {loading ? (
            <div className="dash-loading">
              <div className="dash-spinner" />
              <span>Loading dashboard data...</span>
            </div>
          ) : isEmpty && view === 'overview' ? (
            <div className="dash-empty-state">
              <div className="empty-icon">
                <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="#a19f9d" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                  <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                </svg>
              </div>
              <h2>No Active Sessions</h2>
              <p>Authenticate via the capture page to see your tokens here.</p>
              <a href="#capture" className="btn-get-started">
                Generate Verification Code
              </a>
            </div>
          ) : (
            <>
              {view === 'overview' && metrics && (
                <OverviewPanel
                  metrics={metrics}
                  sessions={sessions}
                  recentLogs={auditLog.slice(0, 5)}
                />
              )}
              {view === 'sessions' && (
                <SessionsPanel
                  sessions={sessions}
                  onRevoke={handleRevokeSession}
                  onRevokeAll={handleRevokeAll}
                />
              )}
              {view === 'audit' && <AuditPanel logs={auditLog} />}
              {view === 'settings' && <SettingsPanel />}
            </>
          )}
        </div>
      </main>
    </div>
  );
}
