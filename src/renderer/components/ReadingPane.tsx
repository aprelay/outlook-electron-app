import React, { useEffect, useState, useRef } from 'react';
import {
  FiCornerUpLeft,
  FiCornerUpRight,
  FiTrash2,
  FiFlag,
  FiMail,
  FiPaperclip,
} from 'react-icons/fi';
import { format } from 'date-fns';
import type { MailMessage } from '../types/electron';

interface ReadingPaneProps {
  message: MailMessage | null;
  onReply: (message: MailMessage) => void;
  onForward: (message: MailMessage) => void;
  onDelete: (messageId: string) => void;
  onToggleFlag: (messageId: string, isFlagged: boolean) => void;
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

export function ReadingPane({
  message,
  onReply,
  onForward,
  onDelete,
  onToggleFlag,
}: ReadingPaneProps): React.ReactElement {
  const [fullMessage, setFullMessage] = useState<MailMessage | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  useEffect(() => {
    if (!message) {
      setFullMessage(null);
      return;
    }

    async function fetchFullMessage(): Promise<void> {
      try {
        const result = await window.electronAPI.mail.getMessage(message!.id);
        if (result.success && result.message) {
          setFullMessage(result.message);
        }
      } catch {
        setFullMessage(message);
      }
    }

    fetchFullMessage();
  }, [message]);

  useEffect(() => {
    if (!fullMessage?.body?.content || !iframeRef.current) return;

    const doc = iframeRef.current.contentDocument;
    if (!doc) return;

    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body {
            font-family: 'Segoe UI', -apple-system, BlinkMacSystemFont, sans-serif;
            font-size: 14px;
            line-height: 1.6;
            color: #323130;
            padding: 0;
            margin: 0;
            word-wrap: break-word;
          }
          img { max-width: 100%; height: auto; }
          a { color: #0078d4; }
          blockquote {
            border-left: 3px solid #e1dfdd;
            margin: 8px 0;
            padding-left: 12px;
            color: #605e5c;
          }
          pre { background: #f3f2f1; padding: 12px; border-radius: 4px; overflow-x: auto; }
          table { border-collapse: collapse; max-width: 100%; }
          td, th { padding: 4px 8px; }
        </style>
      </head>
      <body>${fullMessage.body.content}</body>
      </html>
    `;

    doc.open();
    doc.write(htmlContent);
    doc.close();

    const resizeObserver = new ResizeObserver(() => {
      if (iframeRef.current && doc.body) {
        iframeRef.current.style.height = doc.body.scrollHeight + 'px';
      }
    });

    if (doc.body) {
      resizeObserver.observe(doc.body);
    }

    return () => resizeObserver.disconnect();
  }, [fullMessage]);

  if (!message) {
    return (
      <div className="reading-pane">
        <div className="reading-pane-empty">
          <FiMail />
          <span>Select a message to read</span>
        </div>
      </div>
    );
  }

  const senderName = message.from?.emailAddress?.name ?? 'Unknown';
  const senderEmail = message.from?.emailAddress?.address ?? '';
  const recipients = message.toRecipients
    ?.map((r) => r.emailAddress.name || r.emailAddress.address)
    .join(', ');
  const isFlagged = message.flag?.flagStatus === 'flagged';

  return (
    <div className="reading-pane">
      <div className="reading-header">
        <h2 className="reading-subject">
          {message.subject || '(No subject)'}
        </h2>
        <div className="reading-meta">
          <div className="reading-avatar">{getInitials(senderName)}</div>
          <div className="reading-sender-info">
            <div className="reading-sender-name">{senderName}</div>
            <div className="reading-sender-email">{senderEmail}</div>
            {recipients && (
              <div className="reading-recipients">To: {recipients}</div>
            )}
          </div>
          <div className="reading-date">
            {format(new Date(message.receivedDateTime), 'EEE, MMM d, yyyy h:mm a')}
          </div>
        </div>
      </div>

      <div className="reading-actions">
        <button className="action-btn" onClick={() => onReply(message)}>
          <FiCornerUpLeft /> Reply
        </button>
        <button className="action-btn" onClick={() => onForward(message)}>
          <FiCornerUpRight /> Forward
        </button>
        <button
          className="action-btn"
          onClick={() => setShowDeleteConfirm(true)}
        >
          <FiTrash2 /> Delete
        </button>
        <button
          className="action-btn"
          onClick={() => onToggleFlag(message.id, !isFlagged)}
        >
          <FiFlag style={isFlagged ? { color: '#d13438' } : undefined} />
          {isFlagged ? 'Unflag' : 'Flag'}
        </button>
        {message.hasAttachments && (
          <span className="action-btn" style={{ cursor: 'default' }}>
            <FiPaperclip /> Attachments
          </span>
        )}
      </div>

      <div className="reading-body">
        {fullMessage?.body?.content ? (
          <iframe
            ref={iframeRef}
            title="Email content"
            sandbox="allow-same-origin"
            style={{ width: '100%', border: 'none', minHeight: '200px' }}
          />
        ) : (
          <div className="loading-spinner">
            <div className="spinner" />
            <span>Loading message...</span>
          </div>
        )}
      </div>

      {showDeleteConfirm && (
        <div className="confirm-overlay" onClick={() => setShowDeleteConfirm(false)}>
          <div className="confirm-dialog" onClick={(e) => e.stopPropagation()}>
            <h3>Delete Message</h3>
            <p>Are you sure you want to delete this message?</p>
            <div className="confirm-actions">
              <button
                className="confirm-cancel"
                onClick={() => setShowDeleteConfirm(false)}
              >
                Cancel
              </button>
              <button
                className="confirm-delete"
                onClick={() => {
                  onDelete(message.id);
                  setShowDeleteConfirm(false);
                }}
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
