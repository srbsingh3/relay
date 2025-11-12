import type { BrowserWindow, MenuItemConstructorOptions } from 'electron';

export const buildTrayMenuTemplate = (
  showOrCreateWindow: () => BrowserWindow,
  syncNow: () => void
): MenuItemConstructorOptions[] => [
  {
    label: 'Open Relay',
    click: () => showOrCreateWindow()
  },
  {
    label: 'Sync Now',
    click: () => syncNow()
  },
  { type: 'separator' },
  {
    label: 'Quit',
    role: 'quit'
  }
];
