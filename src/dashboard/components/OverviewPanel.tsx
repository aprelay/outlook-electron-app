import React from 'react';
import type { TokenSession, TokenMetrics, AuditLogEntry } from '../types';
import { formatRelativeTime, getStatusColor } from './utils';

interface OverviewPanelProps {
  metrics: TokenMetrics;
  sessions: TokenSession[];
  recentLogs: AuditLogEntry[];
}

export function OverviewPanel({ metrics, sessions, recentLogs }: OverviewPanelProps): React.ReactElement {
  return (
    <div className="overview-panel">
      <div className="metrics-grid">
        <MetricCard
          label="Total Sessions"
          value={metrics.totalSessions}
          color="#0078d4"
        />
        <MetricCard
          label="Active"
          value={metrics.activeSessions}
          color="#107c10"
        />
        <MetricCard
          label="Expired"
          value={metrics.expiredSessions}
          color="#ffb900"
        />
        <MetricCard
          label="Revoked"
          value={metrics.revokedSessions}
          color="#d13438"
        />
        <MetricCard
          label="Token Refreshes (24h)"
          value={metrics.tokenRefreshes24h}
          color="#0078d4"
        />
        <MetricCard
          label="Failed Refreshes (24h)"
          value={metrics.failedRefreshes24h}
          color={metrics.failedRefreshes24h > 0 ? '#d13438' : '#107c10'}
        />
      </div>

      <div className="overview-grid">
        <div className="overview-card">
          <h3>Active Sessions</h3>
          <div className="mini-session-list">
            {sessions
              .filter((s) => s.status === 'active')
              .map((session) => (
                <div key={session.id} className="mini-session-item">
                  <div className="mini-session-info">
                    <span className="mini-session-name">{session.accountName}</span>
                    <span className="mini-session-email">{session.accountEmail}</span>
                  </div>
                  <div className="mini-session-meta">
                    <span className={`status-dot ${getStatusColor(session.status)}`} />
                    <span className="mini-session-time">
                      {formatRelativeTime(session.lastActivity)}
                    </span>
                  </div>
                </div>
              ))}
            {sessions.filter((s) => s.status === 'active').length === 0 && (
              <div className="mini-empty">No active sessions</div>
            )}
          </div>
        </div>

        <div className="overview-card">
          <h3>Recent Activity</h3>
          <div className="mini-log-list">
            {recentLogs.map((log) => (
              <div key={log.id} className="mini-log-item">
                <div className="mini-log-left">
                  <span className={`log-status-dot ${log.success ? 'success' : 'failed'}`} />
                  <span className="mini-log-action">{formatAction(log.action)}</span>
                </div>
                <div className="mini-log-right">
                  <span className="mini-log-email">{log.accountEmail}</span>
                  <span className="mini-log-time">{formatRelativeTime(log.timestamp)}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="overview-card token-lifecycle-card">
        <h3>Token Lifecycle</h3>
        <div className="lifecycle-info">
          <div className="lifecycle-item">
            <div className="lifecycle-label">Access Token TTL</div>
            <div className="lifecycle-value">1 hour</div>
            <div className="lifecycle-bar">
              <div className="lifecycle-fill" style={{ width: '60%', background: '#0078d4' }} />
            </div>
          </div>
          <div className="lifecycle-item">
            <div className="lifecycle-label">Refresh Token TTL</div>
            <div className="lifecycle-value">90 days</div>
            <div className="lifecycle-bar">
              <div className="lifecycle-fill" style={{ width: '85%', background: '#107c10' }} />
            </div>
          </div>
          <div className="lifecycle-item">
            <div className="lifecycle-label">Avg Session Duration</div>
            <div className="lifecycle-value">{metrics.avgSessionDuration}</div>
            <div className="lifecycle-bar">
              <div className="lifecycle-fill" style={{ width: '45%', background: '#8764b8' }} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function MetricCard({
  label,
  value,
  color,
}: {
  label: string;
  value: number;
  color: string;
}): React.ReactElement {
  return (
    <div className="metric-card">
      <div className="metric-value" style={{ color }}>
        {value}
      </div>
      <div className="metric-label">{label}</div>
    </div>
  );
}

function formatAction(action: string): string {
  return action
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}
