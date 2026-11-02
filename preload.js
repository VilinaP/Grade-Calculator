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

contextBridge.exposeInMainWorld('grades', {
  getByClass: (classId) => ipcRenderer.invoke('grades:getByClass', String(classId)),
  create: (categoryId, name, score) =>
    ipcRenderer.invoke('grades:create', String(categoryId), String(name), Number(score)),
  update: (gradeId, categoryId, name, score) =>
    ipcRenderer.invoke(
      'grades:update',
      String(gradeId),
      String(categoryId),
      String(name),
      Number(score)
    ),
  remove: (gradeId) => ipcRenderer.invoke('grades:delete', String(gradeId)),
});

contextBridge.exposeInMainWorld('finalGradeApi', {
  calculate: (classId) => ipcRenderer.invoke('calculate:final', String(classId)),
});