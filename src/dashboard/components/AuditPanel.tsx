import React, { useState } from 'react';
import type { AuditLogEntry } from '../types';
import { formatDateTime } from './utils';

interface AuditPanelProps {
  logs: AuditLogEntry[];
}

const ACTION_LABELS: Record<string, { label: string; color: string }> = {
  login: { label: 'Login', color: '#0078d4' },
  logout: { label: 'Logout', color: '#605e5c' },
  token_refresh: { label: 'Token Refresh', color: '#107c10' },
  token_revoke: { label: 'Token Revoke', color: '#d13438' },
  token_expired: { label: 'Token Expired', color: '#ffb900' },
  permission_change: { label: 'Permission Change', color: '#8764b8' },
};

export function AuditPanel({ logs }: AuditPanelProps): React.ReactElement {
  const [filterAction, setFilterAction] = useState<string>('all');
  const [filterSuccess, setFilterSuccess] = useState<'all' | 'success' | 'failed'>('all');

  const filtered = logs.filter((log) => {
    if (filterAction !== 'all' && log.action !== filterAction) return false;
    if (filterSuccess === 'success' && !log.success) return false;
    if (filterSuccess === 'failed' && log.success) return false;
    return true;
  });

  const uniqueActions = Array.from(new Set(logs.map((l) => l.action)));

  return (
    <div className="audit-panel">
      <div className="audit-toolbar">
        <div className="filter-group">
          <select
            className="filter-select"
            value={filterAction}
            onChange={(e) => setFilterAction(e.target.value)}
          >
            <option value="all">All Actions</option>
            {uniqueActions.map((action) => (
              <option key={action} value={action}>
                {ACTION_LABELS[action]?.label ?? action}
              </option>
            ))}
          </select>
          <div className="filter-group">
            {(['all', 'success', 'failed'] as const).map((f) => (
              <button
                key={f}
                className={`filter-btn ${filterSuccess === f ? 'active' : ''}`}
                onClick={() => setFilterSuccess(f)}
              >
                {f.charAt(0).toUpperCase() + f.slice(1)}
              </button>
            ))}
          </div>
        </div>
        <div className="audit-count">{filtered.length} entries</div>
      </div>

      <div className="audit-table-wrapper">
        <table className="audit-table">
          <thead>
            <tr>
              <th>Timestamp</th>
              <th>Action</th>
              <th>Account</th>
              <th>IP Address</th>
              <th>Status</th>
              <th>Details</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((log) => {
              const actionInfo = ACTION_LABELS[log.action] ?? {
                label: log.action,
                color: '#605e5c',
              };
              return (
                <tr key={log.id}>
                  <td className="audit-time">{formatDateTime(log.timestamp)}</td>
                  <td>
                    <span
                      className="action-tag"
                      style={{ background: `${actionInfo.color}20`, color: actionInfo.color }}
                    >
                      {actionInfo.label}
                    </span>
                  </td>
                  <td className="audit-email">{log.accountEmail}</td>
                  <td className="audit-ip">{log.ipAddress}</td>
                  <td>
                    <span className={`result-badge ${log.success ? 'success' : 'failed'}`}>
                      {log.success ? 'Success' : 'Failed'}
                    </span>
                  </td>
                  <td className="audit-details">{log.details}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {filtered.length === 0 && (
          <div className="audit-empty">No matching audit entries</div>
        )}
      </div>
    </div>
  );
}
