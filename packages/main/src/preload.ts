import { contextBridge, ipcRenderer } from 'electron';
import type { RendererBridge, KeychainLookupPayload, RegistryWritePayload, SyncInvocationPayload } from './ipc/contracts';
import { IPC_CHANNELS } from './ipc/contracts';

const relayBridge: RendererBridge = {
  version: appVersion(),
  registry: {
    read: () => ipcRenderer.invoke(IPC_CHANNELS.registry.read),
    write: (payload: RegistryWritePayload) => ipcRenderer.invoke(IPC_CHANNELS.registry.write, payload)
  },
  keychain: {
    lookup: (payload: KeychainLookupPayload) => ipcRenderer.invoke(IPC_CHANNELS.keychain.lookup, payload)
  },
  detection: {
    status: () => ipcRenderer.invoke(IPC_CHANNELS.detection.status)
  },
  sync: {
    invoke: (payload: SyncInvocationPayload) => ipcRenderer.invoke(IPC_CHANNELS.sync.invoke, payload),
    status: () => ipcRenderer.invoke(IPC_CHANNELS.sync.status)
  }
};

contextBridge.exposeInMainWorld('relay', relayBridge);

function appVersion() {
  return process.env.npm_package_version ?? '0.0.0';
}

declare global {
  interface Window {
    relay?: RendererBridge;
  }
}
