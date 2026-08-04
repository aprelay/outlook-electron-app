import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('outlookPortal', {
  getConfig: () => ipcRenderer.invoke('portal:get-config'),
  saveConfig: (serverUrl: string, accessKey: string) =>
    ipcRenderer.invoke('portal:save-config', { serverUrl, accessKey }),
  connect: () => ipcRenderer.invoke('portal:connect'),
  openOutlook: () => ipcRenderer.invoke('portal:open-outlook'),
  openTokenDashboard: () => ipcRenderer.invoke('portal:open-token-dashboard'),
  openAdminCenter: () => ipcRenderer.invoke('portal:open-admin-center'),
});
