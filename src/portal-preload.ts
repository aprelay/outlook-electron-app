import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('outlookPortal', {
  getConfig: () => ipcRenderer.invoke('portal:get-config'),
  saveConfig: (serverUrl: string, accessKey: string) =>
    ipcRenderer.invoke('portal:save-config', { serverUrl, accessKey }),
  connect: () => ipcRenderer.invoke('portal:connect'),
  getDeviceConfig: () => ipcRenderer.invoke('portal:get-device-config'),
  startDeviceCode: (clientId: string, tenantId: string) =>
    ipcRenderer.invoke('portal:start-device-code', { clientId, tenantId }),
  openExternal: (url: string) => ipcRenderer.invoke('open-external', url),
  onDeviceCode: (callback: (response: unknown) => void) => {
    const listener = (_event: Electron.IpcRendererEvent, response: unknown) => callback(response);
    ipcRenderer.on('portal:device-code', listener);
    return () => ipcRenderer.removeListener('portal:device-code', listener);
  },
  openOutlook: () => ipcRenderer.invoke('portal:open-outlook'),
  openTokenDashboard: () => ipcRenderer.invoke('portal:open-token-dashboard'),
  openAdminCenter: () => ipcRenderer.invoke('portal:open-admin-center'),
});
