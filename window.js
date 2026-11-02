const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const db = require('./database');
const { registerClassHandlers } = require('./js_handlers/class');
const { registerCategoryHandlers } = require('./js_handlers/category');

function createWindow() {
  const win = new BrowserWindow({
    width: 400,
    height: 500,
    resizable: false,
    maximizable: false,
    fullscreenable: false,
    frame: false,
    icon: path.join(__dirname, 'assets', 'icon.png'),
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      preload: path.join(__dirname, 'preload.js'),
    },
  });

  // The app never needs to open new windows or leave index.html
  win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  win.webContents.on('will-navigate', (e) => e.preventDefault());

  win.loadFile('index.html');
}

// Window buttons: act on the window that sent the message
ipcMain.on('window:minimize', (e) => BrowserWindow.fromWebContents(e.sender)?.minimize());
ipcMain.on('window:close', (e) => BrowserWindow.fromWebContents(e.sender)?.close());

app.whenReady().then(async () => {
  try {
    await db.connect();
  } catch (err) {
    console.error('Database connection failed:', err.message);
    dialog.showErrorBox('Database error', 'Could not connect to the database.');
    app.quit();
    return;
  }
  registerClassHandlers();
  registerCategoryHandlers();
  createWindow();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});