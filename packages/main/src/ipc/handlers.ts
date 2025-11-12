import { ipcMain } from 'electron';

import {
  DetectionSummary,
  IPC_CHANNELS,
  KeychainLookupPayload,
  KeychainLookupResult,
  RegistrySnapshot,
  RegistryWritePayload,
  SupportedAgent,
  SyncInvocationPayload,
  SyncInvocationResult,
  SyncStatusSnapshot
} from './contracts';

let registrySnapshot: RegistrySnapshot = {
  version: 1,
  lastUpdated: new Date().toISOString(),
  servers: []
};

let detectionSummary: DetectionSummary = buildDetectionSummary();
let syncStatus: SyncStatusSnapshot = { state: 'idle', lastRun: null };
let handlersRegistered = false;

const fallbackAgents: SupportedAgent[] = ['cursor', 'claude', 'codex'];

const normalizeRegistryPayload = (payload?: RegistryWritePayload): RegistrySnapshot => {
  if (!payload?.snapshot) {
    return registrySnapshot;
  }

  const nextSnapshot: RegistrySnapshot = {
    ...payload.snapshot,
    version: payload.snapshot.version ?? 1,
    lastUpdated: new Date().toISOString(),
    servers: Array.isArray(payload.snapshot.servers) ? payload.snapshot.servers : []
  };

  return nextSnapshot;
};

function buildDetectionSummary(): DetectionSummary {
  const now = new Date().toISOString();
  return {
    cursor: { detected: false, path: null, lastChecked: now },
    claude: { detected: false, path: null, lastChecked: now },
    codex: { detected: false, path: null, lastChecked: now }
  };
}

const handleRegistryRead = () => registrySnapshot;

const handleRegistryWrite = (_event: Electron.IpcMainInvokeEvent, payload?: RegistryWritePayload) => {
  registrySnapshot = normalizeRegistryPayload(payload);
  return registrySnapshot;
};

const handleKeychainLookup = (_event: Electron.IpcMainInvokeEvent, payload?: KeychainLookupPayload): KeychainLookupResult => {
  const alias = payload?.alias?.trim() ?? '';
  return {
    alias,
    hasSecret: alias.length > 0,
    updatedAt: alias.length > 0 ? new Date().toISOString() : null
  };
};

const handleDetectionStatus = () => detectionSummary;

const resolveSyncApps = (payload?: SyncInvocationPayload): SupportedAgent[] => {
  if (payload?.apps && payload.apps.length > 0) {
    return payload.apps;
  }

  return fallbackAgents;
};

const handleSyncInvoke = (_event: Electron.IpcMainInvokeEvent, payload?: SyncInvocationPayload): SyncInvocationResult => {
  const finishedAt = new Date().toISOString();
  const syncedApps = resolveSyncApps(payload);

  syncStatus = {
    state: 'idle',
    lastRun: finishedAt
  };

  return {
    ok: true,
    finishedAt,
    syncedApps,
    message: `Sync triggered via ${payload?.source ?? 'user'}`
  };
};

const handleSyncStatus = () => syncStatus;

export const registerIpcHandlers = () => {
  if (handlersRegistered) {
    return;
  }

  ipcMain.handle(IPC_CHANNELS.registry.read, handleRegistryRead);
  ipcMain.handle(IPC_CHANNELS.registry.write, handleRegistryWrite);
  ipcMain.handle(IPC_CHANNELS.keychain.lookup, handleKeychainLookup);
  ipcMain.handle(IPC_CHANNELS.detection.status, handleDetectionStatus);
  ipcMain.handle(IPC_CHANNELS.sync.invoke, handleSyncInvoke);
  ipcMain.handle(IPC_CHANNELS.sync.status, handleSyncStatus);

  handlersRegistered = true;
};

export type { RendererBridge } from './contracts';
