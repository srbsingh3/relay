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
import { createEmptyRegistry } from '../registry/schema';
import { loadRegistry, saveRegistry } from '../registry/service';
import { getKeychainService } from '../keychain/service';

let detectionSummary: DetectionSummary = buildDetectionSummary();
let syncStatus: SyncStatusSnapshot = { state: 'idle', lastRun: null };
let handlersRegistered = false;
const keychainService = getKeychainService();

const fallbackAgents: SupportedAgent[] = ['cursor', 'claude', 'codex'];

function buildDetectionSummary(): DetectionSummary {
  const now = new Date().toISOString();
  return {
    cursor: { detected: false, path: null, lastChecked: now },
    claude: { detected: false, path: null, lastChecked: now },
    codex: { detected: false, path: null, lastChecked: now }
  };
}

const readRegistrySnapshot = async (): Promise<RegistrySnapshot> => {
  try {
    return await loadRegistry();
  } catch (error) {
    console.error('[relay] Failed to load registry:', error);
    return createEmptyRegistry();
  }
};

const handleRegistryRead = () => readRegistrySnapshot();

const handleRegistryWrite = async (_event: Electron.IpcMainInvokeEvent, payload?: RegistryWritePayload) => {
  if (!payload?.snapshot) {
    return readRegistrySnapshot();
  }

  try {
    return await saveRegistry(payload.snapshot);
  } catch (error) {
    console.error('[relay] Failed to save registry:', error);
    return readRegistrySnapshot();
  }
};

const handleKeychainLookup = async (
  _event: Electron.IpcMainInvokeEvent,
  payload?: KeychainLookupPayload
): Promise<KeychainLookupResult> => {
  const alias = payload?.alias?.trim() ?? '';
  if (!alias) {
    return {
      alias: '',
      hasSecret: false,
      updatedAt: null
    };
  }

  const hasSecret = await keychainService.hasSecret(alias);
  return {
    alias,
    hasSecret,
    updatedAt: hasSecret ? new Date().toISOString() : null
  };
};

const handleDetectionStatus = () => detectionSummary;

const resolveSyncApps = (payload?: SyncInvocationPayload): SupportedAgent[] => {
  if (payload?.apps && payload.apps.length > 0) {
    return payload.apps;
  }

  return fallbackAgents;
};

const performSync = (payload?: SyncInvocationPayload): SyncInvocationResult => {
  const normalizedPayload: SyncInvocationPayload = {
    source: payload?.source ?? 'user',
    apps: payload?.apps?.length ? payload.apps : undefined
  };

  const finishedAt = new Date().toISOString();
  const syncedApps = resolveSyncApps(normalizedPayload);

  syncStatus = {
    state: 'idle',
    lastRun: finishedAt
  };

  return {
    ok: true,
    finishedAt,
    syncedApps,
    message: `Sync triggered via ${normalizedPayload.source}`
  };
};

const handleSyncInvoke = (_event: Electron.IpcMainInvokeEvent, payload?: SyncInvocationPayload): SyncInvocationResult => {
  return performSync(payload);
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

export const triggerSyncFromMain = (payload?: SyncInvocationPayload) => performSync(payload);

export type { RendererBridge } from './contracts';
