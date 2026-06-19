import React, { useState } from 'react';
import { FiMail, FiHardDrive, FiSettings, FiFolder, FiRefreshCw, FiSearch, FiChrome } from 'react-icons/fi';
import type { SyncSession, UserProfile } from '../types/electron';

interface PortalViewProps {
  accounts: SyncSession[];
  profile: UserProfile | null;
  onOpenEmail: (sessionId: string) => void;
  onLaunchBrowser: (sessionId: string, service: string) => void;
  onRefreshAll: () => void;
  refreshing: boolean;
}

function getInitials(name: string): string {
  if (!name) return '?';
  return name
    .split(' ')
    .map((n) => n.charAt(0))
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

function getAvatarColor(name: string): string {
  const colors = [
    '#7c3aed', '#0078d4', '#00b7c3', '#8764b8',
    '#e3008c', '#d13438', '#ca5010', '#107c10',
  ];
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return colors[Math.abs(hash) % colors.length];
}

function getTimeAgo(expiry: string): string {
  const now = Date.now();
  const exp = new Date(expiry).getTime();
  const diff = exp - now;
  if (diff <= 0) return 'Expired';
  const hours = Math.floor(diff / 3600000);
  const mins = Math.floor((diff % 3600000) / 60000);
  if (hours > 0) return `${hours}h ${mins}m remaining`;
  return `${mins}m remaining`;
}

export function PortalView({
  accounts,
  profile,
  onOpenEmail,
  onLaunchBrowser,
  onRefreshAll,
  refreshing,
}: PortalViewProps): React.ReactElement {
  const [searchQuery, setSearchQuery] = useState('');

  const filteredAccounts = accounts.filter((acc) =>
    acc.accountEmail.toLowerCase().includes(searchQuery.toLowerCase()) ||
    acc.accountName.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="portal-view">
      <div className="portal-header">
        <div className="portal-title-row">
          <h1 className="portal-title">Portal Browser</h1>
          <span className="portal-status-dot" />
        </div>
        <div className="portal-toolbar">
          <div className="portal-search">
            <FiSearch />
            <input
              type="text"
              placeholder="Search tokens..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          <span className="portal-token-count">{accounts.length} tokens</span>
          <button
            className="portal-refresh-btn"
            onClick={onRefreshAll}
            disabled={refreshing}
          >
            <FiRefreshCw className={refreshing ? 'spin' : ''} />
            Refresh
          </button>
        </div>
      </div>

      <div className="portal-accounts-list">
        {filteredAccounts.map((acc) => {
          const isExpired = new Date(acc.accessTokenExpiry).getTime() < Date.now();
          return (
            <div key={acc.id} className="portal-account-card">
              <div className="portal-account-main">
                <div
                  className="portal-avatar"
                  style={{ background: getAvatarColor(acc.accountName || acc.accountEmail) }}
                >
                  {getInitials(acc.accountName || acc.accountEmail)}
                </div>
                <div className="portal-account-info">
                  <div className="portal-account-email">{acc.accountEmail}</div>
                  <div className="portal-account-meta">
                    {acc.accountName && <span>{acc.accountName}</span>}
                  </div>
                </div>
                <div className="portal-account-badges">
                  <span className={`portal-badge ${isExpired ? 'expired' : 'active'}`}>
                    {isExpired ? 'Expired' : 'Active'}
                  </span>
                  <span className="portal-time">{getTimeAgo(acc.accessTokenExpiry)}</span>
                </div>
              </div>
              <div className="portal-service-buttons">
                <button
                  className="service-btn service-owa"
                  onClick={() => onLaunchBrowser(acc.id, 'owa')}
                  title="Open Outlook Web App"
                >
                  <FiMail /> OWA
                </button>
                <button
                  className="service-btn service-onedrive"
                  onClick={() => onLaunchBrowser(acc.id, 'onedrive')}
                  title="Open OneDrive"
                >
                  <FiHardDrive /> OneDrive
                </button>
                <button
                  className="service-btn service-admin"
                  onClick={() => onLaunchBrowser(acc.id, 'admin')}
                  title="Open Admin Center"
                >
                  <FiSettings /> Admin
                </button>
                <button
                  className="service-btn service-sharepoint"
                  onClick={() => onLaunchBrowser(acc.id, 'sharepoint')}
                  title="Open SharePoint"
                >
                  <FiFolder /> SharePoint
                </button>
                <button
                  className="service-btn service-chrome"
                  onClick={() => onLaunchBrowser(acc.id, 'chrome')}
                  title="Export to Chrome (CDP)"
                >
                  <FiChrome /> Chrome
                </button>
                <button
                  className="service-btn service-email"
                  onClick={() => onOpenEmail(acc.id)}
                  title="Read Emails in App"
                >
                  <FiMail /> Inbox
                </button>
              </div>
            </div>
          );
        })}

        {filteredAccounts.length === 0 && (
          <div className="portal-empty">
            <p>No tokens found{searchQuery ? ' matching your search' : ''}</p>
          </div>
        )}
      </div>

      <div className="portal-footer">
        <span className="portal-footer-status">
          Connected as {profile?.mail || profile?.displayName || 'Admin'}
        </span>
      </div>
    </div>
  );
}
