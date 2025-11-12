import { BrowserWindow, Menu, Tray, nativeImage } from 'electron';
import { triggerSyncFromMain } from './ipc/handlers';

interface TrayController {
  showOrCreateWindow: () => BrowserWindow;
}

let trayRef: Tray | null = null;

export const initializeTray = ({ showOrCreateWindow }: TrayController) => {
  if (trayRef) {
    return trayRef;
  }

  const trayIcon = buildTrayIcon();
  trayRef = new Tray(trayIcon);
  trayRef.setToolTip('Relay');
  const contextMenu = Menu.buildFromTemplate(buildMenuTemplate(showOrCreateWindow));
  trayRef.setContextMenu(contextMenu);

  const showMenu = () => {
    if (trayRef) {
      trayRef.popUpContextMenu(contextMenu);
    }
  };

  trayRef.on('click', showMenu);
  trayRef.on('right-click', showMenu);
  trayRef.on('double-click', () => showOrCreateWindow());

  return trayRef;
};

const buildMenuTemplate = (
  showOrCreateWindow: () => BrowserWindow
): Electron.MenuItemConstructorOptions[] => [
  {
    label: 'Open Relay',
    click: () => showOrCreateWindow()
  },
  {
    label: 'Sync Now',
    click: () => handleSyncNow()
  },
  { type: 'separator' },
  {
    label: 'Quit',
    role: 'quit'
  }
];

const handleSyncNow = () => {
  try {
    triggerSyncFromMain({ source: 'tray' });
  } catch (error) {
    console.error('Tray sync invocation failed', error);
  }
};

const buildTrayIcon = () => {
  const trayIconBase64 =
    'iVBORw0KGgoAAAANSUhEUgAAABIAAAASCAYAAABWzo5XAAAALElEQVR42mP4//8/AzUww5AyCBcg2iBiAX0MIhWMGjQYDBp86YiqWWSYFCMAn2tD9QGeN5EAAAAASUVORK5CYII=';

  const icon = nativeImage.createFromDataURL(`data:image/png;base64,${trayIconBase64}`).resize({
    width: 18,
    height: 18,
    quality: 'best'
  });

  icon.setTemplateImage(true);
  return icon;
};
