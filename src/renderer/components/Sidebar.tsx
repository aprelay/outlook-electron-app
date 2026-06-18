import React from 'react';
import {
  FiInbox,
  FiSend,
  FiEdit,
  FiTrash2,
  FiArchive,
  FiAlertCircle,
  FiFolder,
  FiPlus,
  FiLogOut,
  FiStar,
} from 'react-icons/fi';
import type { UserProfile, MailFolder } from '../types/electron';

interface SidebarProps {
  profile: UserProfile | null;
  folders: MailFolder[];
  selectedFolder: MailFolder | null;
  onFolderSelect: (folder: MailFolder) => void;
  onCompose: () => void;
  onLogout: () => void;
}

const FOLDER_ICONS: Record<string, React.ReactNode> = {
  inbox: <FiInbox />,
  'sent items': <FiSend />,
  drafts: <FiEdit />,
  'deleted items': <FiTrash2 />,
  archive: <FiArchive />,
  'junk email': <FiAlertCircle />,
  outbox: <FiSend />,
  'conversation history': <FiFolder />,
  'clutter': <FiFolder />,
};

function getFolderIcon(name: string): React.ReactNode {
  const lowerName = name.toLowerCase();
  for (const [key, icon] of Object.entries(FOLDER_ICONS)) {
    if (lowerName.includes(key)) {
      return icon;
    }
  }
  return <FiFolder />;
}

function getFolderOrder(name: string): number {
  const order = [
    'inbox',
    'drafts',
    'sent items',
    'outbox',
    'deleted items',
    'junk email',
    'archive',
  ];
  const idx = order.findIndex((o) => name.toLowerCase().includes(o));
  return idx >= 0 ? idx : 99;
}

function getInitials(name: string): string {
  return name
    .split(' ')
    .map((n) => n.charAt(0))
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

export function Sidebar({
  profile,
  folders,
  selectedFolder,
  onFolderSelect,
  onCompose,
  onLogout,
}: SidebarProps): React.ReactElement {
  const sortedFolders = [...folders].sort(
    (a, b) => getFolderOrder(a.displayName) - getFolderOrder(b.displayName)
  );

  return (
    <div className="sidebar">
      <div className="sidebar-header">
        <h2>
          <FiStar style={{ marginRight: 8, verticalAlign: 'middle' }} />
          Mail
        </h2>
      </div>

      <button className="compose-btn" onClick={onCompose}>
        <FiPlus />
        New Message
      </button>

      <div className="folder-list">
        {sortedFolders.map((folder) => (
          <div
            key={folder.id}
            className={`folder-item ${selectedFolder?.id === folder.id ? 'active' : ''}`}
            onClick={() => onFolderSelect(folder)}
          >
            <span className="folder-icon">
              {getFolderIcon(folder.displayName)}
            </span>
            <span className="folder-name">{folder.displayName}</span>
            {folder.unreadItemCount > 0 && (
              <span className="unread-badge">{folder.unreadItemCount}</span>
            )}
          </div>
        ))}
      </div>

      {profile && (
        <div className="user-section">
          <div className="user-avatar">
            {getInitials(profile.displayName)}
          </div>
          <div className="user-info">
            <div className="user-name">{profile.displayName}</div>
            <div className="user-email">
              {profile.mail || profile.userPrincipalName}
            </div>
          </div>
          <button className="logout-btn" onClick={onLogout} title="Sign out">
            <FiLogOut />
          </button>
        </div>
      )}
    </div>
  );
}
