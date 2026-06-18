import React from 'react';
import type { DashboardView } from '../types';

interface SidebarProps {
  currentView: DashboardView;
  onNavigate: (view: DashboardView) => void;
}

const NAV_ITEMS: { view: DashboardView; label: string; icon: string }[] = [
  { view: 'overview', label: 'Overview', icon: '📊' },
  { view: 'sessions', label: 'Sessions', icon: '🔑' },
  { view: 'audit', label: 'Audit Log', icon: '📋' },
  { view: 'settings', label: 'Settings', icon: '⚙️' },
];

export function Sidebar({ currentView, onNavigate }: SidebarProps): React.ReactElement {
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
        {NAV_ITEMS.map((item) => (
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
            <div className="badge-detail">OAuth 2.0 + Encrypted Storage</div>
          </div>
        </div>
      </div>
    </aside>
  );
}
