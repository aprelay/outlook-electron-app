import React, { useState, useCallback } from 'react';
import { FiSearch, FiFlag, FiPaperclip, FiAlertTriangle, FiMail } from 'react-icons/fi';
import { format, isToday, isYesterday, isThisYear } from 'date-fns';
import type { MailMessage } from '../types/electron';

interface EmailListProps {
  folderName: string;
  messages: MailMessage[];
  selectedMessage: MailMessage | null;
  loading: boolean;
  page: number;
  searchQuery: string;
  onMessageSelect: (message: MailMessage) => void;
  onSearch: (query: string) => void;
  onPageChange: (page: number) => void;
  onToggleFlag: (messageId: string, isFlagged: boolean) => void;
  onOpenInChrome?: () => void;
}

function formatDate(dateString: string): string {
  const date = new Date(dateString);
  if (isToday(date)) return format(date, 'h:mm a');
  if (isYesterday(date)) return 'Yesterday';
  if (isThisYear(date)) return format(date, 'MMM d');
  return format(date, 'MMM d, yyyy');
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
    '#0078d4', '#00b7c3', '#8764b8', '#e3008c',
    '#d13438', '#ca5010', '#498205', '#107c10',
  ];
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return colors[Math.abs(hash) % colors.length];
}

export function EmailList({
  folderName,
  messages,
  selectedMessage,
  loading,
  page,
  searchQuery,
  onMessageSelect,
  onSearch,
  onPageChange,
  onToggleFlag,
  onOpenInChrome,
}: EmailListProps): React.ReactElement {
  const [localSearch, setLocalSearch] = useState(searchQuery);
  const [searchTimeout, setSearchTimeout] = useState<ReturnType<typeof setTimeout> | null>(null);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(null);

  const debouncedSearch = useCallback(
    (query: string) => {
      if (searchTimeout) clearTimeout(searchTimeout);
      const timeout = setTimeout(() => onSearch(query), 400);
      setSearchTimeout(timeout);
    },
    [onSearch, searchTimeout]
  );

  function handleSearchChange(e: React.ChangeEvent<HTMLInputElement>): void {
    const value = e.target.value;
    setLocalSearch(value);
    debouncedSearch(value);
  }

  function handleSearchSubmit(e: React.FormEvent): void {
    e.preventDefault();
    if (searchTimeout) clearTimeout(searchTimeout);
    onSearch(localSearch);
  }

  function handleContextMenu(e: React.MouseEvent): void {
    e.preventDefault();
    setContextMenu({ x: e.clientX, y: e.clientY });
  }

  function closeContextMenu(): void {
    setContextMenu(null);
  }

  return (
    <div className="email-list-panel" onClick={closeContextMenu}>
      <div className="email-list-header">
        <div className="email-list-title">{folderName}</div>
        <form onSubmit={handleSearchSubmit} className="search-bar">
          <FiSearch />
          <input
            type="text"
            placeholder="Search emails..."
            value={localSearch}
            onChange={handleSearchChange}
          />
        </form>
      </div>

      <div className="email-list-content">
        {loading ? (
          <div className="loading-spinner">
            <div className="spinner" />
            <span>Loading messages...</span>
          </div>
        ) : messages.length === 0 ? (
          <div className="empty-state">
            <FiMail />
            <p>No messages found</p>
          </div>
        ) : (
          messages.map((message) => {
            const senderName = message.from?.emailAddress?.name ?? message.from?.emailAddress?.address ?? 'Unknown';
            const isFlagged = message.flag?.flagStatus === 'flagged';
            const isImportant = message.importance === 'high';

            return (
              <div
                key={message.id}
                className={`email-item ${selectedMessage?.id === message.id ? 'selected' : ''} ${!message.isRead ? 'unread' : ''}`}
                onClick={() => onMessageSelect(message)}
                onContextMenu={handleContextMenu}
              >
                {!message.isRead && <div className="unread-dot" />}
                <div className="email-avatar-col">
                  <div
                    className="email-avatar"
                    style={{ background: getAvatarColor(senderName) }}
                  >
                    {getInitials(senderName)}
                  </div>
                </div>
                <div className="email-content">
                  <div className="email-top-row">
                    <span className="email-sender">{senderName}</span>
                    <span className="email-time">
                      {formatDate(message.receivedDateTime)}
                    </span>
                  </div>
                  <div className="email-subject">
                    {message.subject || '(No subject)'}
                  </div>
                  <div className="email-preview">
                    {message.bodyPreview || ''}
                  </div>
                  <div className="email-meta-icons">
                    {message.hasAttachments && <FiPaperclip />}
                    {isImportant && <FiAlertTriangle className="important" />}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onToggleFlag(message.id, !isFlagged);
                      }}
                      style={{ display: 'flex', alignItems: 'center', padding: 0, background: 'none', border: 'none', cursor: 'pointer' }}
                    >
                      <FiFlag className={isFlagged ? 'flagged' : ''} />
                    </button>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {messages.length > 0 && !searchQuery && (
        <div className="pagination">
          <button
            onClick={() => onPageChange(page - 1)}
            disabled={page === 0}
          >
            Previous
          </button>
          <span>Page {page + 1}</span>
          <button
            onClick={() => onPageChange(page + 1)}
            disabled={messages.length < 25}
          >
            Next
          </button>
        </div>
      )}

      {contextMenu && onOpenInChrome && (
        <div
          className="context-menu"
          style={{ top: contextMenu.y, left: contextMenu.x }}
        >
          <button
            className="context-menu-item"
            onClick={() => {
              onOpenInChrome();
              closeContextMenu();
            }}
          >
            Open in Chrome as Session
          </button>
        </div>
      )}
    </div>
  );
}
