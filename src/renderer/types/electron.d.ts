export interface MailMessage {
  id: string;
  subject: string;
  bodyPreview: string;
  body?: { contentType: string; content: string };
  from: { emailAddress: { name: string; address: string } };
  toRecipients: { emailAddress: { name: string; address: string } }[];
  ccRecipients?: { emailAddress: { name: string; address: string } }[];
  receivedDateTime: string;
  isRead: boolean;
  flag: { flagStatus: string };
  hasAttachments: boolean;
  importance: string;
  parentFolderId: string;
  conversationId?: string;
}

export interface MailFolder {
  id: string;
  displayName: string;
  parentFolderId: string;
  childFolderCount: number;
  unreadItemCount: number;
  totalItemCount: number;
}

export interface UserProfile {
  displayName: string;
  mail: string;
  userPrincipalName: string;
  jobTitle: string;
}

export interface AuthResult {
  success: boolean;
  error?: string;
  profile?: UserProfile;
}

export interface AuthCheckResult {
  authenticated: boolean;
  profile?: UserProfile;
}

export interface MailResult<T = undefined> {
  success: boolean;
  error?: string;
  folders?: MailFolder[];
  messages?: MailMessage[];
  message?: MailMessage;
  draft?: MailMessage;
  totalCount?: number;
  data?: T;
}

export interface SendMessageData {
  to: string[];
  cc?: string[];
  bcc?: string[];
  subject: string;
  body: string;
  isHtml: boolean;
  replyToId?: string;
}

export interface DeviceCodeInfo {
  userCode: string;
  verificationUri: string;
  message: string;
  expiresIn: number;
}

export interface SyncSession {
  id: string;
  accountEmail: string;
  accountName: string;
  accessTokenExpiry: string;
}

export interface SyncResult {
  success: boolean;
  error?: string;
  sessions?: SyncSession[];
  profile?: UserProfile;
  accounts?: SyncSession[];
  activeAccountEmail?: string;
}

export interface BrowserSessionResult {
  success: boolean;
  error?: string;
}

export interface ElectronAPI {
  auth: {
    login: () => Promise<AuthResult>;
    logout: () => Promise<{ success: boolean; error?: string }>;
    check: () => Promise<AuthCheckResult>;
    openVerification: (url: string) => Promise<void>;
    onDeviceCode: (callback: (data: DeviceCodeInfo) => void) => void;
    onDeviceCodeComplete: (callback: (data: { success: boolean; error?: string }) => void) => void;
    removeDeviceCodeListeners: () => void;
  };
  mail: {
    getFolders: () => Promise<MailResult>;
    getMessages: (folderId: string, page: number, pageSize: number) => Promise<MailResult>;
    getMessage: (messageId: string) => Promise<MailResult>;
    sendMessage: (data: SendMessageData) => Promise<MailResult>;
    moveMessage: (messageId: string, destinationFolderId: string) => Promise<MailResult>;
    deleteMessage: (messageId: string) => Promise<MailResult>;
    toggleRead: (messageId: string, isRead: boolean) => Promise<MailResult>;
    toggleFlag: (messageId: string, isFlagged: boolean) => Promise<MailResult>;
    search: (query: string) => Promise<MailResult>;
    saveDraft: (data: { to: string[]; cc?: string[]; subject: string; body: string; isHtml: boolean }) => Promise<MailResult>;
  };
  notification: {
    show: (title: string, body: string) => Promise<void>;
  };
  sync: {
    fetchSessions: (password: string) => Promise<SyncResult>;
    importToken: (password: string, sessionId: string) => Promise<SyncResult>;
    refreshImportedToken: () => Promise<{ success: boolean; error?: string }>;
    fetchAndImportAll: (password: string) => Promise<SyncResult>;
    switchAccount: (sessionId: string) => Promise<SyncResult>;
    refreshAll: () => Promise<SyncResult>;
  };
  openInChrome: () => Promise<void>;
  launchBrowserSession: (sessionId: string, service: string) => Promise<BrowserSessionResult>;
}

declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
}
