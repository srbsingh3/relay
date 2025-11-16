import type { BrowserWindowConstructorOptions } from 'electron';

interface WindowOptionsArgs {
  preloadPath: string;
  isMac: boolean;
  allowDevTools: boolean;
}

export const buildMainWindowOptions = ({
  preloadPath,
  isMac,
  allowDevTools
}: WindowOptionsArgs): BrowserWindowConstructorOptions => ({
  width: 1100,
  height: 700,
  minWidth: 1100,
  minHeight: 700,
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
    devTools: allowDevTools
  }
});
