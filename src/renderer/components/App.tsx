import React, { useState, useEffect, useCallback } from 'react';
import { LoginScreen } from './LoginScreen';
import { Sidebar } from './Sidebar';
import { EmailList } from './EmailList';
import { ReadingPane } from './ReadingPane';
import { ComposeModal } from './ComposeModal';
import { ToastContainer, useToast } from './Toast';
import type { UserProfile, MailFolder, MailMessage } from '../types/electron';

type ComposeMode = 'new' | 'reply' | 'forward';

interface ComposeState {
  mode: ComposeMode;
  replyToMessage?: MailMessage;
}

export function App(): React.ReactElement {
  const [authenticated, setAuthenticated] = useState(false);
  const [checking, setChecking] = useState(true);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [folders, setFolders] = useState<MailFolder[]>([]);
  const [selectedFolder, setSelectedFolder] = useState<MailFolder | null>(null);
  const [messages, setMessages] = useState<MailMessage[]>([]);
  const [selectedMessage, setSelectedMessage] = useState<MailMessage | null>(null);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [page, setPage] = useState(0);
  const [composeState, setComposeState] = useState<ComposeState | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const { toasts, addToast, removeToast } = useToast();

  useEffect(() => {
    checkAuth();
  }, []);

  async function checkAuth(): Promise<void> {
    try {
      const result = await window.electronAPI.auth.check();
      if (result.authenticated && result.profile) {
        setAuthenticated(true);
        setProfile(result.profile);
        loadFolders();
      }
    } catch {
      // Not authenticated
    } finally {
      setChecking(false);
    }
  }

  async function handleLogin(): Promise<void> {
    try {
      const result = await window.electronAPI.auth.login();
      if (result.success && result.profile) {
        setAuthenticated(true);
        setProfile(result.profile);
        addToast('success', `Welcome, ${result.profile.displayName}!`);
        loadFolders();
      } else {
        addToast('error', result.error ?? 'Login failed');
      }
    } catch (error) {
      addToast('error', 'Login failed. Please try again.');
    }
  }

  async function handleLogout(): Promise<void> {
    try {
      await window.electronAPI.auth.logout();
      setAuthenticated(false);
      setProfile(null);
      setFolders([]);
      setMessages([]);
      setSelectedFolder(null);
      setSelectedMessage(null);
      addToast('info', 'Signed out successfully');
    } catch {
      addToast('error', 'Logout failed');
    }
  }

  async function loadFolders(): Promise<void> {
    try {
      const result = await window.electronAPI.mail.getFolders();
      if (result.success && result.folders) {
        setFolders(result.folders);
        const inbox = result.folders.find(
          (f) => f.displayName.toLowerCase() === 'inbox'
        );
        if (inbox) {
          setSelectedFolder(inbox);
          loadMessages(inbox.id, 0);
        }
      }
    } catch {
      addToast('error', 'Failed to load mail folders');
    }
  }

  const loadMessages = useCallback(
    async (folderId: string, pageNum: number): Promise<void> => {
      setLoadingMessages(true);
      try {
        const result = await window.electronAPI.mail.getMessages(folderId, pageNum, 25);
        if (result.success && result.messages) {
          setMessages(result.messages);
          setPage(pageNum);
        }
      } catch {
        addToast('error', 'Failed to load messages');
      } finally {
        setLoadingMessages(false);
      }
    },
    [addToast]
  );

  function handleFolderSelect(folder: MailFolder): void {
    setSelectedFolder(folder);
    setSelectedMessage(null);
    setSearchQuery('');
    loadMessages(folder.id, 0);
  }

  async function handleMessageSelect(message: MailMessage): Promise<void> {
    setSelectedMessage(message);

    if (!message.isRead) {
      await window.electronAPI.mail.toggleRead(message.id, true);
      setMessages((prev) =>
        prev.map((m) => (m.id === message.id ? { ...m, isRead: true } : m))
      );
    }
  }

  function handleCompose(mode: ComposeMode, replyToMessage?: MailMessage): void {
    setComposeState({ mode, replyToMessage });
  }

  async function handleSendMessage(data: {
    to: string[];
    cc?: string[];
    bcc?: string[];
    subject: string;
    body: string;
    isHtml: boolean;
    replyToId?: string;
  }): Promise<void> {
    try {
      const result = await window.electronAPI.mail.sendMessage(data);
      if (result.success) {
        addToast('success', 'Message sent successfully');
        setComposeState(null);
        if (selectedFolder) {
          loadMessages(selectedFolder.id, page);
        }
      } else {
        addToast('error', result.error ?? 'Failed to send message');
      }
    } catch {
      addToast('error', 'Failed to send message');
    }
  }

  async function handleDeleteMessage(messageId: string): Promise<void> {
    try {
      const result = await window.electronAPI.mail.deleteMessage(messageId);
      if (result.success) {
        addToast('info', 'Message deleted');
        if (selectedMessage?.id === messageId) {
          setSelectedMessage(null);
        }
        setMessages((prev) => prev.filter((m) => m.id !== messageId));
      }
    } catch {
      addToast('error', 'Failed to delete message');
    }
  }

  async function handleToggleFlag(messageId: string, isFlagged: boolean): Promise<void> {
    try {
      const result = await window.electronAPI.mail.toggleFlag(messageId, isFlagged);
      if (result.success) {
        setMessages((prev) =>
          prev.map((m) =>
            m.id === messageId
              ? { ...m, flag: { flagStatus: isFlagged ? 'flagged' : 'notFlagged' } }
              : m
          )
        );
        if (selectedMessage?.id === messageId) {
          setSelectedMessage((prev) =>
            prev
              ? { ...prev, flag: { flagStatus: isFlagged ? 'flagged' : 'notFlagged' } }
              : null
          );
        }
      }
    } catch {
      addToast('error', 'Failed to update flag');
    }
  }

  async function handleSearch(query: string): Promise<void> {
    setSearchQuery(query);
    if (!query.trim()) {
      if (selectedFolder) {
        loadMessages(selectedFolder.id, 0);
      }
      return;
    }

    setLoadingMessages(true);
    try {
      const result = await window.electronAPI.mail.search(query);
      if (result.success && result.messages) {
        setMessages(result.messages);
        setSelectedMessage(null);
      }
    } catch {
      addToast('error', 'Search failed');
    } finally {
      setLoadingMessages(false);
    }
  }

  if (checking) {
    return (
      <div className="loading-spinner" style={{ height: '100vh' }}>
        <div className="spinner" />
        <span>Initializing...</span>
      </div>
    );
  }

  if (!authenticated) {
    return (
      <>
        <LoginScreen onLogin={handleLogin} />
        <ToastContainer toasts={toasts} onRemove={removeToast} />
      </>
    );
  }

  return (
    <div className="app-layout">
      <Sidebar
        profile={profile}
        folders={folders}
        selectedFolder={selectedFolder}
        onFolderSelect={handleFolderSelect}
        onCompose={() => handleCompose('new')}
        onLogout={handleLogout}
      />
      <EmailList
        folderName={selectedFolder?.displayName ?? 'Inbox'}
        messages={messages}
        selectedMessage={selectedMessage}
        loading={loadingMessages}
        page={page}
        searchQuery={searchQuery}
        onMessageSelect={handleMessageSelect}
        onSearch={handleSearch}
        onPageChange={(newPage) => {
          if (selectedFolder) {
            loadMessages(selectedFolder.id, newPage);
          }
        }}
        onToggleFlag={handleToggleFlag}
      />
      <ReadingPane
        message={selectedMessage}
        onReply={(msg) => handleCompose('reply', msg)}
        onForward={(msg) => handleCompose('forward', msg)}
        onDelete={handleDeleteMessage}
        onToggleFlag={handleToggleFlag}
      />
      {composeState && (
        <ComposeModal
          mode={composeState.mode}
          replyToMessage={composeState.replyToMessage}
          onSend={handleSendMessage}
          onSaveDraft={async (data) => {
            try {
              const result = await window.electronAPI.mail.saveDraft(data);
              if (result.success) {
                addToast('info', 'Draft saved');
                setComposeState(null);
              }
            } catch {
              addToast('error', 'Failed to save draft');
            }
          }}
          onClose={() => setComposeState(null)}
        />
      )}
      <ToastContainer toasts={toasts} onRemove={removeToast} />
    </div>
  );
}
