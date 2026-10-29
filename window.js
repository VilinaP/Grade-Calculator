const { app, BrowserWindow, ipcMain } = require("electron");
const path = require("path");

function createWindow() {
  const win = new BrowserWindow({
    width: 400,
    height: 500,
    resizable: false,
    maximizable: false,
    fullscreenable: false,
    frame: false,
    transparent: false,
    icon: "assets/icon.png",
    webPreferences: {
      contextIsolation: true,
      preload: path.join(__dirname, "preload.js")
    }
  });

  win.loadFile("index.html");
}

ipcMain.on("window:minimize", (event) => {
  BrowserWindow.fromWebContents(event.sender).minimize();
});

ipcMain.on("window:close", (event) => {
  BrowserWindow.fromWebContents(event.sender).close();
});

app.whenReady().then(createWindow);

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});