import React, { useState, useEffect } from 'react';
import { Sidebar } from './Sidebar';
import { OverviewPanel } from './OverviewPanel';
import { SessionsPanel } from './SessionsPanel';
import { AuditPanel } from './AuditPanel';
import { SettingsPanel } from './SettingsPanel';
import { generateMockSessions, generateMockMetrics, generateMockAuditLog } from '../api/mockData';
import type { TokenSession, TokenMetrics, AuditLogEntry, DashboardView } from '../types';

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
      setSessions(generateMockSessions());
      setMetrics(generateMockMetrics());
      setAuditLog(generateMockAuditLog());
      setLoading(false);
    }, 600);
  }

  function handleRevokeSession(sessionId: string): void {
    setSessions((prev) =>
      prev.map((s) =>
        s.id === sessionId ? { ...s, status: 'revoked' as const } : s
      )
    );
    setAuditLog((prev) => {
      const session = sessions.find((s) => s.id === sessionId);
      return [
        {
          id: `log_${Date.now()}`,
          timestamp: new Date().toISOString(),
          action: 'token_revoke' as const,
          accountEmail: session?.accountEmail ?? 'unknown',
          ipAddress: session?.ipAddress ?? 'unknown',
          details: 'Session revoked by administrator via dashboard.',
          success: true,
        },
        ...prev,
      ];
    });
    if (metrics) {
      setMetrics({
        ...metrics,
        activeSessions: metrics.activeSessions - 1,
        revokedSessions: metrics.revokedSessions + 1,
      });
    }
  }

  function handleRevokeAll(): void {
    setSessions((prev) =>
      prev.map((s) =>
        s.status === 'active' ? { ...s, status: 'revoked' as const } : s
      )
    );
    if (metrics) {
      setMetrics({
        ...metrics,
        activeSessions: 0,
        revokedSessions: metrics.revokedSessions + metrics.activeSessions,
      });
    }
  }

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
