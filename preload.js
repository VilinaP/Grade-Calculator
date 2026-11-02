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

contextBridge.exposeInMainWorld('categories', {
  getByClass: (classId) => ipcRenderer.invoke('categories:getByClass', String(classId)),
  create: (classId, name, percentage) =>
    ipcRenderer.invoke('categories:create', String(classId), String(name), Number(percentage)),
  update: (categoryId, name, percentage) =>
    ipcRenderer.invoke('categories:update', String(categoryId), String(name), Number(percentage)),
  remove: (categoryId) => ipcRenderer.invoke('categories:delete', String(categoryId)),
});