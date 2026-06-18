import React, { useState, useRef, useCallback } from 'react';
import {
  FiX,
  FiSend,
  FiTrash2,
  FiBold,
  FiItalic,
  FiUnderline,
  FiList,
} from 'react-icons/fi';
import type { MailMessage, SendMessageData } from '../types/electron';

type ComposeMode = 'new' | 'reply' | 'forward';

interface ComposeModalProps {
  mode: ComposeMode;
  replyToMessage?: MailMessage;
  onSend: (data: SendMessageData) => Promise<void>;
  onSaveDraft: (data: {
    to: string[];
    cc?: string[];
    subject: string;
    body: string;
    isHtml: boolean;
  }) => Promise<void>;
  onClose: () => void;
}

function getReplySubject(subject: string, mode: ComposeMode): string {
  const cleanSubject = subject.replace(/^(Re:|Fw:|Fwd:)\s*/gi, '').trim();
  if (mode === 'reply') return `Re: ${cleanSubject}`;
  if (mode === 'forward') return `Fw: ${cleanSubject}`;
  return '';
}

function getReplyTo(message: MailMessage | undefined, mode: ComposeMode): string {
  if (!message) return '';
  if (mode === 'reply') {
    return message.from?.emailAddress?.address ?? '';
  }
  return '';
}

function getQuotedBody(message: MailMessage | undefined, mode: ComposeMode): string {
  if (!message) return '';
  const senderName = message.from?.emailAddress?.name ?? '';
  const senderEmail = message.from?.emailAddress?.address ?? '';
  const date = new Date(message.receivedDateTime).toLocaleString();
  const separator = mode === 'reply'
    ? `<br/><br/>On ${date}, ${senderName} &lt;${senderEmail}&gt; wrote:`
    : `<br/><br/>---------- Forwarded message ----------<br/>From: ${senderName} &lt;${senderEmail}&gt;<br/>Date: ${date}<br/>Subject: ${message.subject}`;

  return `${separator}<br/><blockquote style="border-left:3px solid #ccc;padding-left:12px;color:#605e5c;">${message.bodyPreview ?? ''}</blockquote>`;
}

export function ComposeModal({
  mode,
  replyToMessage,
  onSend,
  onSaveDraft,
  onClose,
}: ComposeModalProps): React.ReactElement {
  const [to, setTo] = useState(getReplyTo(replyToMessage, mode));
  const [cc, setCc] = useState('');
  const [bcc, setBcc] = useState('');
  const [subject, setSubject] = useState(
    replyToMessage ? getReplySubject(replyToMessage.subject, mode) : ''
  );
  const [showCcBcc, setShowCcBcc] = useState(false);
  const [sending, setSending] = useState(false);
  const editorRef = useRef<HTMLDivElement>(null);

  const initialBody = replyToMessage ? getQuotedBody(replyToMessage, mode) : '';

  const parseEmails = useCallback((input: string): string[] => {
    return input
      .split(/[,;]/)
      .map((e) => e.trim())
      .filter((e) => e.length > 0 && e.includes('@'));
  }, []);

  async function handleSend(): Promise<void> {
    const toList = parseEmails(to);
    if (toList.length === 0) return;

    setSending(true);
    try {
      const bodyHtml = editorRef.current?.innerHTML ?? '';
      const data: SendMessageData = {
        to: toList,
        cc: cc ? parseEmails(cc) : undefined,
        bcc: bcc ? parseEmails(bcc) : undefined,
        subject,
        body: bodyHtml,
        isHtml: true,
        replyToId: mode === 'reply' ? replyToMessage?.id : undefined,
      };
      await onSend(data);
    } finally {
      setSending(false);
    }
  }

  async function handleSaveDraft(): Promise<void> {
    const toList = parseEmails(to);
    const bodyHtml = editorRef.current?.innerHTML ?? '';
    await onSaveDraft({
      to: toList,
      cc: cc ? parseEmails(cc) : undefined,
      subject,
      body: bodyHtml,
      isHtml: true,
    });
  }

  function execCommand(command: string, value?: string): void {
    document.execCommand(command, false, value);
    editorRef.current?.focus();
  }

  return (
    <div className="compose-overlay" onClick={onClose}>
      <div className="compose-modal" onClick={(e) => e.stopPropagation()}>
        <div className="compose-header">
          <h3>
            {mode === 'new' && 'New Message'}
            {mode === 'reply' && 'Reply'}
            {mode === 'forward' && 'Forward'}
          </h3>
          <button className="compose-close-btn" onClick={onClose}>
            <FiX />
          </button>
        </div>

        <div className="compose-fields">
          <div className="compose-field">
            <label>To</label>
            <input
              type="text"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              placeholder="recipient@example.com"
              autoFocus={mode === 'new'}
            />
            {!showCcBcc && (
              <button
                onClick={() => setShowCcBcc(true)}
                style={{
                  fontSize: '12px',
                  color: 'var(--primary)',
                  whiteSpace: 'nowrap',
                }}
              >
                Cc/Bcc
              </button>
            )}
          </div>
          {showCcBcc && (
            <>
              <div className="compose-field">
                <label>Cc</label>
                <input
                  type="text"
                  value={cc}
                  onChange={(e) => setCc(e.target.value)}
                  placeholder="cc@example.com"
                />
              </div>
              <div className="compose-field">
                <label>Bcc</label>
                <input
                  type="text"
                  value={bcc}
                  onChange={(e) => setBcc(e.target.value)}
                  placeholder="bcc@example.com"
                />
              </div>
            </>
          )}
          <div className="compose-field">
            <label>Subject</label>
            <input
              type="text"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="Subject"
            />
          </div>
        </div>

        <div className="compose-toolbar">
          <button
            className="toolbar-btn"
            onClick={() => execCommand('bold')}
            title="Bold"
          >
            <FiBold />
          </button>
          <button
            className="toolbar-btn"
            onClick={() => execCommand('italic')}
            title="Italic"
          >
            <FiItalic />
          </button>
          <button
            className="toolbar-btn"
            onClick={() => execCommand('underline')}
            title="Underline"
          >
            <FiUnderline />
          </button>
          <button
            className="toolbar-btn"
            onClick={() => execCommand('insertUnorderedList')}
            title="Bullet list"
          >
            <FiList />
          </button>
          <button
            className="toolbar-btn"
            onClick={() => execCommand('insertOrderedList')}
            title="Numbered list"
            style={{ fontWeight: 700, fontSize: '12px' }}
          >
            1.
          </button>
          <button
            className="toolbar-btn"
            onClick={() => execCommand('formatBlock', 'blockquote')}
            title="Quote"
            style={{ fontWeight: 700, fontSize: '16px' }}
          >
            &ldquo;
          </button>
        </div>

        <div className="compose-body">
          <div
            ref={editorRef}
            contentEditable
            suppressContentEditableWarning
            className="DraftEditor-root"
            style={{
              minHeight: '250px',
              padding: '12px 20px',
              outline: 'none',
              fontSize: '14px',
              lineHeight: '1.6',
            }}
            dangerouslySetInnerHTML={{ __html: initialBody }}
          />
        </div>

        <div className="compose-footer">
          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              className="send-btn"
              onClick={handleSend}
              disabled={sending || !to.trim()}
            >
              <FiSend />
              {sending ? 'Sending...' : 'Send'}
            </button>
            <button className="discard-btn" onClick={handleSaveDraft}>
              Save Draft
            </button>
          </div>
          <button className="discard-btn" onClick={onClose}>
            <FiTrash2 /> Discard
          </button>
        </div>
      </div>
    </div>
  );
}
