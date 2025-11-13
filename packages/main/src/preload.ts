import { contextBridge, ipcRenderer } from 'electron';
import type {
  RendererBridge,
  KeychainLookupPayload,
  KeychainSavePayload,
  RegistryWritePayload,
  SyncInvocationPayload,
  UpdateCheckPayload,
  UpdatePreferencePayload
} from './ipc/contracts';
import { IPC_CHANNELS } from './ipc/contracts';

const relayBridge: RendererBridge = {
  version: appVersion(),
  registry: {
    read: () => ipcRenderer.invoke(IPC_CHANNELS.registry.read),
    write: (payload: RegistryWritePayload) => ipcRenderer.invoke(IPC_CHANNELS.registry.write, payload)
  },
  keychain: {
    lookup: (payload: KeychainLookupPayload) => ipcRenderer.invoke(IPC_CHANNELS.keychain.lookup, payload),
    save: (payload: KeychainSavePayload) => ipcRenderer.invoke(IPC_CHANNELS.keychain.save, payload)
  },
  detection: {
    status: () => ipcRenderer.invoke(IPC_CHANNELS.detection.status),
    refresh: () => ipcRenderer.invoke(IPC_CHANNELS.detection.refresh)
  },
  sync: {
    invoke: (payload: SyncInvocationPayload) => ipcRenderer.invoke(IPC_CHANNELS.sync.invoke, payload),
    status: () => ipcRenderer.invoke(IPC_CHANNELS.sync.status)
  },
  updates: {
    status: () => ipcRenderer.invoke(IPC_CHANNELS.updates.status),
    check: (payload: UpdateCheckPayload) => ipcRenderer.invoke(IPC_CHANNELS.updates.check, payload),
    preference: (payload: UpdatePreferencePayload) => ipcRenderer.invoke(IPC_CHANNELS.updates.preference, payload)
  }
};

contextBridge.exposeInMainWorld('relay', relayBridge);

function appVersion() {
  if (typeof process === 'undefined') {
    return '0.0.0';
  }

  return process.env?.npm_package_version ?? '0.0.0';
}

declare global {
  interface Window {
    relay?: RendererBridge;
  }
}
