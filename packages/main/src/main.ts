import { existsSync } from 'node:fs';
import path from 'node:path';
import { app, BrowserWindow, nativeTheme } from 'electron';

const isMac = process.platform === 'darwin';
const rendererHtml = path.join(__dirname, '../../renderer/dist/index.html');
const preloadPath = path.join(__dirname, 'preload.js');

const ensureRendererBundle = () => {
  if (!existsSync(rendererHtml)) {
    throw new Error(
      'Renderer bundle missing. Run `npm run build:renderer` (or dev watcher) so index.html stays local.'
    );
  }

  return rendererHtml;
};

const createWindow = () => {
  const window = new BrowserWindow({
    width: 900,
    height: 600,
    minWidth: 900,
    minHeight: 600,
    show: false,
    title: 'Relay',
    titleBarStyle: 'hiddenInset',
    backgroundColor: '#050814cc',
    transparent: true,
    autoHideMenuBar: true,
    ...(isMac
      ? {
          trafficLightPosition: { x: 16, y: 18 },
          vibrancy: 'under-window',
          visualEffectState: 'active'
        }
      : {}),
    webPreferences: {
      preload: preloadPath,
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      devTools: !app.isPackaged
    }
  });

  window.once('ready-to-show', () => window.show());
  window.loadFile(ensureRendererBundle());
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

app.on('browser-window-created', (_, createdWindow) => {
  createdWindow.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  createdWindow.webContents.on('will-navigate', (event, url) => {
    if (!url.startsWith('file://')) {
      event.preventDefault();
    }
  });
});

app.on('window-all-closed', () => {
  if (!isMac) {
    app.quit();
  }
});
