import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('outlookDesktop', {
  openExternal: (url: string) => ipcRenderer.invoke('open-external', url),
  platform: process.platform,
});
