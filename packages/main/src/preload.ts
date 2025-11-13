import { contextBridge, ipcRenderer } from 'electron';
import type {
  RendererBridge,
  KeychainLookupPayload,
  KeychainSavePayload,
  RegistryWritePayload,
  SyncInvocationPayload,
  UpdateCheckPayload,
  UpdatePreferencePayload,
  IpcChannels
} from './ipc/contracts';

const CHANNELS: IpcChannels = {
  registry: {
    read: 'relay:registry:read',
    write: 'relay:registry:write'
  },
  keychain: {
    lookup: 'relay:keychain:lookup',
    save: 'relay:keychain:save'
  },
  detection: {
    status: 'relay:detection:status',
    refresh: 'relay:detection:refresh'
  },
  sync: {
    invoke: 'relay:sync:invoke',
    status: 'relay:sync:status'
  },
  updates: {
    status: 'relay:updates:status',
    check: 'relay:updates:check',
    preference: 'relay:updates:preference'
  }
};

const relayBridge: RendererBridge = {
  version: appVersion(),
  registry: {
    read: () => ipcRenderer.invoke(CHANNELS.registry.read),
    write: (payload: RegistryWritePayload) => ipcRenderer.invoke(CHANNELS.registry.write, payload)
  },
  keychain: {
    lookup: (payload: KeychainLookupPayload) => ipcRenderer.invoke(CHANNELS.keychain.lookup, payload),
    save: (payload: KeychainSavePayload) => ipcRenderer.invoke(CHANNELS.keychain.save, payload)
  },
  detection: {
    status: () => ipcRenderer.invoke(CHANNELS.detection.status),
    refresh: () => ipcRenderer.invoke(CHANNELS.detection.refresh)
  },
  sync: {
    invoke: (payload: SyncInvocationPayload) => ipcRenderer.invoke(CHANNELS.sync.invoke, payload),
    status: () => ipcRenderer.invoke(CHANNELS.sync.status)
  },
  updates: {
    status: () => ipcRenderer.invoke(CHANNELS.updates.status),
    check: (payload: UpdateCheckPayload) => ipcRenderer.invoke(CHANNELS.updates.check, payload),
    preference: (payload: UpdatePreferencePayload) => ipcRenderer.invoke(CHANNELS.updates.preference, payload)
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
