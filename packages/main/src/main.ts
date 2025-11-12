import path from 'node:path';
import { app, BrowserWindow, nativeTheme } from 'electron';

const rendererDist = path.join(__dirname, '../../renderer/dist');
const preloadPath = path.join(__dirname, 'preload.js');

const createWindow = () => {
  const window = new BrowserWindow({
    width: 900,
    height: 600,
    minWidth: 900,
    minHeight: 600,
    backgroundColor: '#0b0b0f',
    title: 'Relay',
    show: false,
    webPreferences: {
      preload: preloadPath,
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  });

  window.once('ready-to-show', () => window.show());

  window.loadFile(path.join(rendererDist, 'index.html'));
};

app.whenReady().then(() => {
  nativeTheme.themeSource = 'dark';
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
