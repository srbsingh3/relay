import { contextBridge } from 'electron';

contextBridge.exposeInMainWorld('relay', {
  version: appVersion()
});

function appVersion() {
  return process.env.npm_package_version ?? '0.0.0';
}

declare global {
  interface Window {
    relay: {
      version: string;
    };
  }
}
