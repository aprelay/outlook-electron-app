import React from 'react';
import type { DashboardView, AdminRole } from '../types';

interface SidebarProps {
  currentView: DashboardView;
  onNavigate: (view: DashboardView) => void;
  role: AdminRole;
}

const NAV_ITEMS: { view: DashboardView; label: string; icon: string; adminOnly?: boolean }[] = [
  { view: 'overview', label: 'Overview', icon: '📊' },
  { view: 'sessions', label: 'Sessions', icon: '🔑' },
  { view: 'emails', label: 'Emails', icon: '📧' },
  { view: 'audit', label: 'Audit Log', icon: '📋' },
  { view: 'settings', label: 'Settings', icon: '⚙️', adminOnly: true },
];

export function Sidebar({ currentView, onNavigate, role }: SidebarProps): React.ReactElement {
  const visibleItems = NAV_ITEMS.filter((item) => !item.adminOnly || role === 'admin');

  return (
    <aside className="dash-sidebar">
      <div className="dash-sidebar-brand">
        <div className="brand-icon">T</div>
        <div>
          <div className="brand-title">Token Manager</div>
          <div className="brand-subtitle">OAuth 2.0 Dashboard</div>
        </div>
      </div>

      <nav className="dash-nav">
        {visibleItems.map((item) => (
          <button
            key={item.view}
            className={`dash-nav-item ${currentView === item.view ? 'active' : ''}`}
            onClick={() => onNavigate(item.view)}
          >
            <span className="nav-icon">{item.icon}</span>
            <span>{item.label}</span>
          </button>
        ))}
      </nav>

      <div className="dash-sidebar-footer">
        <div className="security-badge">
          <span className="shield-icon">🛡️</span>
          <div>
            <div className="badge-title">Enterprise Security</div>
            <div className="badge-detail">OAuth 2.0 + Server-Side Storage</div>
          </div>
        </div>
        <div className="role-badge">
          Role: <strong>{role.toUpperCase()}</strong>
        </div>
      </div>
    </aside>
  );
}
