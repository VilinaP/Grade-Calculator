const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('windowControls', {
  minimize: () => ipcRenderer.send('window:minimize'),
  close: () => ipcRenderer.send('window:close'),
});

contextBridge.exposeInMainWorld('classes', {
  getAll: () => ipcRenderer.invoke('classes:getAll'),
  create: (name) => ipcRenderer.invoke('classes:create', String(name)),
  remove: (classId) => ipcRenderer.invoke('classes:delete', String(classId)),
});