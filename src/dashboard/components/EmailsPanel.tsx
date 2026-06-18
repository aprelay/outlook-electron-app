import React, { useState, useEffect } from 'react';
import type { TokenSession, Email } from '../types';
import { formatRelativeTime } from './utils';

interface EmailsPanelProps {
  sessions: TokenSession[];
  storedPassword: string;
}

export function EmailsPanel({ sessions, storedPassword }: EmailsPanelProps): React.ReactElement {
  const [selectedSessionId, setSelectedSessionId] = useState('');
  const [emails, setEmails] = useState<Email[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [selectedEmail, setSelectedEmail] = useState<Email | null>(null);
  const [folder, setFolder] = useState('inbox');

  const activeSessions = sessions.filter((s) => s.status === 'active');

  useEffect(() => {
    if (activeSessions.length > 0 && !selectedSessionId) {
      setSelectedSessionId(activeSessions[0].id);
    }
  }, [activeSessions, selectedSessionId]);

  useEffect(() => {
    if (selectedSessionId) {
      fetchEmails();
    }
  }, [selectedSessionId, folder]);

  async function fetchEmails(): Promise<void> {
    setLoading(true);
    setError('');
    setSelectedEmail(null);
    try {
      const res = await fetch('/api/emails', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Admin-Password': storedPassword,
        },
        body: JSON.stringify({ sessionId: selectedSessionId, folder, top: 30 }),
      });
      const data = await res.json() as { emails?: Email[]; error?: string };
      if (data.error) {
        setError(data.error);
        setEmails([]);
      } else {
        setEmails(data.emails ?? []);
      }
    } catch {
      setError('Failed to connect');
    }
    setLoading(false);
  }

  if (activeSessions.length === 0) {
    return (
      <div className="emails-empty">
        <h3>No Active Sessions</h3>
        <p>You need an active session with a valid token to access emails.</p>
      </div>
    );
  }

  return (
    <div className="emails-panel">
      <div className="emails-toolbar">
        <select
          className="emails-session-select"
          value={selectedSessionId}
          onChange={(e) => setSelectedSessionId(e.target.value)}
        >
          {activeSessions.map((s) => (
            <option key={s.id} value={s.id}>
              {s.accountEmail} ({s.accountName})
            </option>
          ))}
        </select>
        <div className="emails-folder-tabs">
          {['inbox', 'sentitems', 'drafts', 'deleteditems'].map((f) => (
            <button
              key={f}
              className={`folder-tab ${folder === f ? 'active' : ''}`}
              onClick={() => setFolder(f)}
            >
              {f === 'inbox' ? 'Inbox' : f === 'sentitems' ? 'Sent' : f === 'drafts' ? 'Drafts' : 'Trash'}
            </button>
          ))}
        </div>
        <button className="btn-refresh-sm" onClick={fetchEmails}>
          Reload
        </button>
      </div>

      {error && <div className="emails-error">{error}</div>}

      <div className="emails-layout">
        <div className="emails-list">
          {loading ? (
            <div className="emails-loading">Loading emails...</div>
          ) : emails.length === 0 ? (
            <div className="emails-loading">No emails in this folder</div>
          ) : (
            emails.map((email) => (
              <div
                key={email.id}
                className={`email-item ${!email.isRead ? 'unread' : ''} ${selectedEmail?.id === email.id ? 'selected' : ''}`}
                onClick={() => setSelectedEmail(email)}
              >
                <div className="email-item-header">
                  <span className="email-from">{email.from.split('<')[0].trim() || email.fromEmail}</span>
                  <span className="email-date">{formatRelativeTime(email.date)}</span>
                </div>
                <div className="email-subject">{email.subject}</div>
                <div className="email-preview">{email.preview}</div>
                <div className="email-meta">
                  {email.hasAttachments && <span className="email-attachment-badge">Attachment</span>}
                  {email.importance === 'high' && <span className="email-high-importance">High</span>}
                </div>
              </div>
            ))
          )}
        </div>
        <div className="email-reading-pane">
          {selectedEmail ? (
            <div className="email-detail">
              <h2 className="email-detail-subject">{selectedEmail.subject}</h2>
              <div className="email-detail-meta">
                <div><strong>From:</strong> {selectedEmail.from}</div>
                <div><strong>To:</strong> {selectedEmail.to.join(', ')}</div>
                <div><strong>Date:</strong> {new Date(selectedEmail.date).toLocaleString()}</div>
                {selectedEmail.hasAttachments && <div className="email-attachment-notice">Has attachments</div>}
              </div>
              <div className="email-detail-body">{selectedEmail.preview}</div>
            </div>
          ) : (
            <div className="email-no-selection">
              Select an email to read
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
