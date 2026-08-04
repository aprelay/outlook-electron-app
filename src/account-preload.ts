import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('accountManager', {
  getState: () => ipcRenderer.invoke('account:get-state'),
  saveConfig: (clientId: string, tenantId: string) =>
    ipcRenderer.invoke('account:save-config', { clientId, tenantId }),
  signIn: () => ipcRenderer.invoke('account:sign-in'),
  refresh: (homeAccountId: string) => ipcRenderer.invoke('account:refresh', homeAccountId),
  remove: (homeAccountId: string) => ipcRenderer.invoke('account:remove', homeAccountId),
  removeAll: () => ipcRenderer.invoke('account:remove-all'),
  openExternal: (url: string) => ipcRenderer.invoke('open-external', url),
  onDeviceCode: (callback: (response: unknown) => void) => {
    const listener = (_event: Electron.IpcRendererEvent, response: unknown) => callback(response);
    ipcRenderer.on('account:device-code', listener);
    return () => ipcRenderer.removeListener('account:device-code', listener);
  },
});
