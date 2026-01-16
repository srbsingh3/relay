import { existsSync } from 'node:fs';
import path from 'node:path';
import { app, BrowserWindow, nativeTheme, session } from 'electron';
import { registerIpcHandlers } from './ipc/handlers';
import { initializeTray } from './tray';
import { buildMainWindowOptions } from './window-options';

const isMac = process.platform === 'darwin';
const rendererHtml = path.join(__dirname, '../../renderer/dist/index.html');
const preloadPath = path.join(__dirname, 'preload.js');
let mainWindow: BrowserWindow | null = null;

const ensureRendererBundle = () => {
  if (!existsSync(rendererHtml)) {
    throw new Error(
      'Renderer bundle missing. Run `npm run build:renderer` (or dev watcher) so index.html stays local.'
    );
  }

  return rendererHtml;
};

const applySecurityPolicies = () => {
  if (!session.defaultSession) {
    return;
  }

  const cspValue = "default-src 'self'";

  session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
    const responseHeaders: Record<string, string[]> = {
      ...(details.responseHeaders ?? {}),
      'Content-Security-Policy': [cspValue]
    };

    // Chromium expects header keys in their original case, so keep both variants.
    if (responseHeaders['content-security-policy']) {
      responseHeaders['content-security-policy'] = [cspValue];
    }

    callback({ responseHeaders });
  });

  session.defaultSession.webRequest.onBeforeRequest({ urls: ['*://*/*'] }, (details, callback) => {
    try {
      const { protocol } = new URL(details.url);
      if (protocol === 'file:' || protocol === 'devtools:') {
        callback({ cancel: false });
        return;
      }
    } catch {
      // If the URL cannot be parsed, err on the side of blocking.
    }

    callback({ cancel: true });
  });
};

const createWindow = (): BrowserWindow => {
  if (mainWindow) {
    return mainWindow;
  }

  const window = new BrowserWindow(
    buildMainWindowOptions({
      preloadPath,
      isMac,
      allowDevTools: !app.isPackaged
    })
  );

  window.once('ready-to-show', () => {
    // In development, show without stealing focus to avoid disrupting workflow
    if (app.isPackaged) {
      window.show();
    } else {
      window.showInactive();
    }
  });
  window.loadFile(ensureRendererBundle());

  window.on('closed', () => {
    mainWindow = null;
  });

  mainWindow = window;
  return window;
};

const showOrCreateWindow = (): BrowserWindow => {
  const window = mainWindow ?? createWindow();

  if (window.isMinimized()) {
    window.restore();
  }

  if (!window.isVisible()) {
    window.show();
  }

  window.focus();
  return window;
};

app.whenReady().then(() => {
  nativeTheme.themeSource = 'dark';
  applySecurityPolicies();
  registerIpcHandlers();
  createWindow();
  initializeTray({ showOrCreateWindow });

  app.on('activate', () => {
    showOrCreateWindow();
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
