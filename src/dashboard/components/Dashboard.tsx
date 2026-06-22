import React, { useState, useEffect } from 'react';
import { Sidebar } from './Sidebar';
import { OverviewPanel } from './OverviewPanel';
import { SessionsPanel } from './SessionsPanel';
import { AuditPanel } from './AuditPanel';
import { SettingsPanel } from './SettingsPanel';
import { EmailsPanel } from './EmailsPanel';
import { PagesPanel } from './PagesPanel';
import { ImportTokenPanel } from './ImportTokenPanel';
import type { TokenSession, TokenMetrics, AuditLogEntry, DashboardView, AdminRole } from '../types';

function computeMetrics(sessions: TokenSession[], auditLog: AuditLogEntry[]): TokenMetrics {
  const active = sessions.filter((s) => s.status === 'active').length;
  const expired = sessions.filter((s) => s.status === 'expired').length;
  const revoked = sessions.filter((s) => s.status === 'revoked').length;

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
  const [authenticated, setAuthenticated] = useState(false);
  const [password, setPassword] = useState('');
  const [loginError, setLoginError] = useState('');
  const [loggingIn, setLoggingIn] = useState(false);
  const [role, setRole] = useState<AdminRole>('viewer');

  const [view, setView] = useState<DashboardView>('overview');
  const [sessions, setSessions] = useState<TokenSession[]>([]);
  const [metrics, setMetrics] = useState<TokenMetrics | null>(null);
  const [auditLog, setAuditLog] = useState<AuditLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [storedPassword, setStoredPassword] = useState('');

  useEffect(() => {
    const saved = sessionStorage.getItem('admin_password');
    const savedRole = sessionStorage.getItem('admin_role') as AdminRole | null;
    if (saved) {
      setStoredPassword(saved);
      setRole(savedRole || 'viewer');
      setAuthenticated(true);
    }
  }, []);

  useEffect(() => {
    if (authenticated && storedPassword) {
      loadData();
    }
  }, [authenticated, storedPassword]);

  async function handleLogin(e: React.FormEvent): Promise<void> {
    e.preventDefault();
    setLoggingIn(true);
    setLoginError('');
    try {
      const res = await fetch('/api/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'login', password }),
      });
      const data = await res.json() as { success: boolean; role?: AdminRole };
      if (data.success) {
        const userRole = data.role || 'admin';
        sessionStorage.setItem('admin_password', password);
        sessionStorage.setItem('admin_role', userRole);
        setStoredPassword(password);
        setRole(userRole);
        setAuthenticated(true);
      } else {
        setLoginError('Invalid password');
      }
    } catch {
      setLoginError('Connection error');
    }
    setLoggingIn(false);
  }

  async function loadData(): Promise<void> {
    setLoading(true);
    try {
      const res = await fetch('/api/sessions', {
        method: 'GET',
        headers: { 'X-Admin-Password': storedPassword },
      });
      if (res.status === 401) {
        setAuthenticated(false);
        sessionStorage.removeItem('admin_password');
        return;
      }
      const data = await res.json() as { sessions: TokenSession[]; auditLog: AuditLogEntry[] };

      const now = Date.now();
      const updated = data.sessions.map((s: TokenSession) => {
        if (s.status === 'active' && new Date(s.accessTokenExpiry).getTime() < now) {
          if (new Date(s.refreshTokenExpiry).getTime() < now) {
            return { ...s, status: 'expired' as const };
          }
        }
        return s;
      });

      setSessions(updated);
      setAuditLog(data.auditLog);
      setMetrics(computeMetrics(updated, data.auditLog));
    } catch {
      // network error
    }
    setLoading(false);
  }

  async function handleRevokeSession(sessionId: string): Promise<void> {
    const session = sessions.find((s) => s.id === sessionId);
    await fetch('/api/sessions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Admin-Password': storedPassword },
      body: JSON.stringify({
        action: 'revoke_session',
        sessionId,
        auditEntry: {
          id: `log_${Date.now()}`,
          timestamp: new Date().toISOString(),
          action: 'token_revoke',
          accountEmail: session?.accountEmail ?? 'unknown',
          ipAddress: session?.ipAddress ?? 'unknown',
          details: 'Session revoked by administrator via dashboard.',
          success: true,
        },
      }),
    });
    loadData();
  }

  async function handleRevokeAll(): Promise<void> {
    await fetch('/api/sessions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Admin-Password': storedPassword },
      body: JSON.stringify({
        action: 'revoke_all',
        auditEntry: {
          id: `log_${Date.now()}`,
          timestamp: new Date().toISOString(),
          action: 'token_revoke',
          accountEmail: 'all',
          ipAddress: 'Web Client',
          details: 'All sessions revoked by administrator.',
          success: true,
        },
      }),
    });
    loadData();
  }

  async function handleRefreshToken(sessionId: string): Promise<{ success: boolean; error?: string }> {
    try {
      const res = await fetch('/api/refresh-token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Admin-Password': storedPassword },
        body: JSON.stringify({ sessionId }),
      });
      const data = await res.json() as { success: boolean; error?: string };
      if (data.success) loadData();
      return data;
    } catch {
      return { success: false, error: 'Network error' };
    }
  }

  async function handleRefreshAll(): Promise<{ refreshed: number; failed: number }> {
    try {
      const res = await fetch('/api/refresh-token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Admin-Password': storedPassword },
        body: JSON.stringify({ refreshAll: true }),
      });
      const data = await res.json() as { refreshed: number; failed: number };
      loadData();
      return data;
    } catch {
      return { refreshed: 0, failed: 0 };
    }
  }

  async function handleCheckToken(sessionId: string): Promise<{ valid: boolean; reason?: string }> {
    try {
      const res = await fetch('/api/check-token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Admin-Password': storedPassword },
        body: JSON.stringify({ sessionId }),
      });
      const data = await res.json() as { valid: boolean; reason?: string };
      loadData();
      return data;
    } catch {
      return { valid: false, reason: 'Network error' };
    }
  }

  async function handleBrokerUpgrade(sessionId: string): Promise<{ success: boolean; error?: string }> {
    try {
      const res = await fetch('/api/broker-upgrade', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId }),
      });
      const data = await res.json() as { success: boolean; error?: string };
      loadData();
      return data;
    } catch {
      return { success: false, error: 'Network error' };
    }
  }

  async function handleDeleteSession(sessionId: string): Promise<void> {
    const session = sessions.find((s) => s.id === sessionId);
    await fetch('/api/sessions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Admin-Password': storedPassword },
      body: JSON.stringify({
        action: 'delete_session',
        sessionId,
        auditEntry: {
          id: `log_${Date.now()}`,
          timestamp: new Date().toISOString(),
          action: 'session_deleted',
          accountEmail: session?.accountEmail ?? 'unknown',
          ipAddress: 'Web Client',
          details: 'Session permanently deleted by administrator.',
          success: true,
        },
      }),
    });
    loadData();
  }

  async function handleDeleteAll(): Promise<void> {
    await fetch('/api/sessions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Admin-Password': storedPassword },
      body: JSON.stringify({
        action: 'delete_all',
        auditEntry: {
          id: `log_${Date.now()}`,
          timestamp: new Date().toISOString(),
          action: 'all_sessions_deleted',
          accountEmail: 'all',
          ipAddress: 'Web Client',
          details: `All ${sessions.length} sessions permanently deleted by administrator.`,
          success: true,
        },
      }),
    });
    loadData();
  }

  function handleViewEmails(sessionId: string): void {
    setView('emails');
  }

  function handleLogout(): void {
    sessionStorage.removeItem('admin_password');
    sessionStorage.removeItem('admin_role');
    setAuthenticated(false);
    setStoredPassword('');
    setPassword('');
    setSessions([]);
    setAuditLog([]);
  }

  if (!authenticated) {
    return (
      <div className="admin-login-page">
        <div className="admin-login-card">
          <div className="admin-login-brand">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#0078d4" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
              <path d="M7 11V7a5 5 0 0 1 10 0v4" />
            </svg>
            <h1>Token Dashboard</h1>
          </div>
          <p className="admin-login-desc">Enter the admin password to access token management.</p>
          <form onSubmit={handleLogin}>
            <input
              type="password"
              className="admin-login-input"
              placeholder="Admin Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoFocus
            />
            {loginError && <div className="admin-login-error">{loginError}</div>}
            <button type="submit" className="admin-login-btn" disabled={loggingIn || !password}>
              {loggingIn ? 'Signing in...' : 'Sign In'}
            </button>
          </form>
        </div>
      </div>
    );
  }

  const isEmpty = !loading && sessions.length === 0;

  return (
    <div className="dashboard-layout">
      <Sidebar currentView={view} onNavigate={setView} role={role} />
      <main className="dashboard-main">
        <header className="dashboard-header">
          <h1>
            {view === 'overview' && 'Token Overview'}
            {view === 'sessions' && 'Active Sessions'}
            {view === 'audit' && 'Audit Log'}
            {view === 'emails' && 'Email Access'}
            {view === 'pages' && 'Pages'}
            {view === 'settings' && 'Settings'}
          </h1>
          <div className="header-actions">
            <a href="/" className="btn-new-session">
              + New Session
            </a>
            <button className="btn-refresh" onClick={loadData}>
              Refresh
            </button>
            <button className="btn-logout" onClick={handleLogout}>
              Logout
            </button>
            <span className="last-updated">
              Last updated: {new Date().toLocaleTimeString()}
            </span>
          </div>
        </header>

        <div className="dashboard-content">
          {loading && view !== 'emails' ? (
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
              <a href="/" className="btn-get-started">
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
                  onDelete={handleDeleteSession}
                  onDeleteAll={handleDeleteAll}
                  onRefresh={handleRefreshToken}
                  onRefreshAll={handleRefreshAll}
                  onCheckToken={handleCheckToken}
                  onBrokerUpgrade={handleBrokerUpgrade}
                  onViewEmails={handleViewEmails}
                  adminRole={role}
                />
              )}
              {view === 'emails' && (
                <EmailsPanel sessions={sessions} storedPassword={storedPassword} />
              )}
              {view === 'audit' && <AuditPanel logs={auditLog} />}
              {view === 'pages' && <PagesPanel storedPassword={storedPassword} />}
              {view === 'import' && <ImportTokenPanel storedPassword={storedPassword} onImportSuccess={loadData} />}
              {view === 'settings' && <SettingsPanel />}
            </>
          )}
        </div>
      </main>
    </div>
  );
}
