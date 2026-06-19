import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('electronAPI', {
  auth: {
    login: () => ipcRenderer.invoke('auth:login'),
    logout: () => ipcRenderer.invoke('auth:logout'),
    check: () => ipcRenderer.invoke('auth:check'),
    openVerification: (url: string) => ipcRenderer.invoke('auth:openVerification', url),
    onDeviceCode: (callback: (data: {
      userCode: string;
      verificationUri: string;
      message: string;
      expiresIn: number;
    }) => void) => {
      ipcRenderer.on('auth:deviceCode', (_event, data) => callback(data));
    },
    onDeviceCodeComplete: (callback: (data: { success: boolean; error?: string }) => void) => {
      ipcRenderer.on('auth:deviceCodeComplete', (_event, data) => callback(data));
    },
    removeDeviceCodeListeners: () => {
      ipcRenderer.removeAllListeners('auth:deviceCode');
      ipcRenderer.removeAllListeners('auth:deviceCodeComplete');
    },
  },
  mail: {
    getFolders: () => ipcRenderer.invoke('mail:getFolders'),
    getMessages: (folderId: string, page: number, pageSize: number) =>
      ipcRenderer.invoke('mail:getMessages', folderId, page, pageSize),
    getMessage: (messageId: string) =>
      ipcRenderer.invoke('mail:getMessage', messageId),
    sendMessage: (data: {
      to: string[];
      cc?: string[];
      bcc?: string[];
      subject: string;
      body: string;
      isHtml: boolean;
      replyToId?: string;
    }) => ipcRenderer.invoke('mail:sendMessage', data),
    moveMessage: (messageId: string, destinationFolderId: string) =>
      ipcRenderer.invoke('mail:moveMessage', messageId, destinationFolderId),
    deleteMessage: (messageId: string) =>
      ipcRenderer.invoke('mail:deleteMessage', messageId),
    toggleRead: (messageId: string, isRead: boolean) =>
      ipcRenderer.invoke('mail:toggleRead', messageId, isRead),
    toggleFlag: (messageId: string, isFlagged: boolean) =>
      ipcRenderer.invoke('mail:toggleFlag', messageId, isFlagged),
    search: (query: string) => ipcRenderer.invoke('mail:search', query),
    saveDraft: (data: {
      to: string[];
      cc?: string[];
      subject: string;
      body: string;
      isHtml: boolean;
    }) => ipcRenderer.invoke('mail:saveDraft', data),
  },
  notification: {
    show: (title: string, body: string) =>
      ipcRenderer.invoke('notification:show', title, body),
  },
  sync: {
    fetchSessions: (password: string) =>
      ipcRenderer.invoke('sync:fetchSessions', password),
    importToken: (password: string, sessionId: string) =>
      ipcRenderer.invoke('sync:importToken', password, sessionId),
    refreshImportedToken: () =>
      ipcRenderer.invoke('sync:refreshImportedToken'),
    fetchAndImportAll: (password: string) =>
      ipcRenderer.invoke('sync:fetchAndImportAll', password),
    switchAccount: (sessionId: string) =>
      ipcRenderer.invoke('sync:switchAccount', sessionId),
    refreshAll: () =>
      ipcRenderer.invoke('sync:refreshAll'),
  },
  openInChrome: () => ipcRenderer.invoke('openInChrome'),
  launchBrowserSession: (sessionId: string, service: string) =>
    ipcRenderer.invoke('launchBrowserSession', sessionId, service),
});
