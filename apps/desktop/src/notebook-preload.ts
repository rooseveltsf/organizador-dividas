import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('notebookTutorial', {
  read: () => ipcRenderer.invoke('tutorial:read'),
  save: (value: unknown) => ipcRenderer.invoke('tutorial:save', value),
});
