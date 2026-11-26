import { contextBridge, ipcRenderer } from 'electron';
import type { ImportCredentials } from './desktop-data';

contextBridge.exposeInMainWorld('importDatabase', {
  choose: () => ipcRenderer.invoke('import-database:choose'),
  confirm: (credentials: ImportCredentials) => ipcRenderer.invoke('import-database:confirm', credentials),
});
