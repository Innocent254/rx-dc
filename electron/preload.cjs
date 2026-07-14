const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('rxdc', {
  request: (path, options = {}) => ipcRenderer.invoke('rxdc:request', { path, ...options }),
  selectFiles: () => ipcRenderer.invoke('rxdc:select-files'),
  selectFolder: () => ipcRenderer.invoke('rxdc:select-folder'),
  appInfo: () => ipcRenderer.invoke('rxdc:app-info'),
  openLogs: () => ipcRenderer.invoke('rxdc:open-logs'),
  onBackendExit: (callback) => {
    const listener = (_event, payload) => callback(payload);
    ipcRenderer.on('rxdc:backend-exit', listener);
    return () => ipcRenderer.removeListener('rxdc:backend-exit', listener);
  }
});
