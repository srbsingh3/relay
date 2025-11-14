import { ipcMain } from 'electron';

import {
  IPC_CHANNELS,
  KeychainLookupPayload,
  KeychainLookupResult,
  KeychainSavePayload,
  KeychainSaveResult,
  RegistrySnapshot,
  RegistryWritePayload,
  SyncInvocationPayload,
  SyncInvocationResult,
  UpdateCheckPayload,
  UpdatePreferencePayload,
  UpdateStatusSnapshot
} from './contracts';
import { createEmptyRegistry } from '../registry/schema';
import { loadRegistry, saveRegistry } from '../registry/service';
import { getKeychainService } from '../keychain/service';
import { getDetectionService } from '../detection/service';
import { getUpdateService } from '../update/service';
import { getSyncService } from '../sync/service';

let handlersRegistered = false;
const keychainService = getKeychainService();
const detectionService = getDetectionService();
const updateService = getUpdateService();
const syncService = getSyncService();

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

const handleKeychainSave = async (
  _event: Electron.IpcMainInvokeEvent,
  payload?: KeychainSavePayload
): Promise<KeychainSaveResult> => {
  const alias = payload?.alias?.trim() ?? '';
  const secret = payload?.secret ?? '';

  if (!alias || !secret) {
    return { ok: false, error: 'Alias and secret are required.' };
  }

  try {
    await keychainService.setSecret(alias, secret);
    return { ok: true };
  } catch (error) {
    console.error('[relay] Failed to store secret:', error);
    return { ok: false, error: 'Unable to store secret in Keychain.' };
  }
};

const handleDetectionStatus = async () => detectionService.getSummary();

const handleDetectionRefresh = async () => detectionService.refresh();

const handleSyncInvoke = (
  _event: Electron.IpcMainInvokeEvent,
  payload?: SyncInvocationPayload
): Promise<SyncInvocationResult> => {
  return syncService.syncNow(payload);
};

const handleSyncStatus = () => syncService.getStatus();

const handleUpdateStatus = (): UpdateStatusSnapshot => {
  return updateService.getStatus();
};

const handleUpdateCheck = (
  _event: Electron.IpcMainInvokeEvent,
  payload?: UpdateCheckPayload
): Promise<UpdateStatusSnapshot> => {
  return updateService.checkForUpdates(payload);
};

const handleUpdatePreference = (
  _event: Electron.IpcMainInvokeEvent,
  payload?: UpdatePreferencePayload
): UpdateStatusSnapshot => {
  const enabled = payload?.autoCheckEnabled ?? true;
  return updateService.setAutoCheckEnabled(enabled);
};

export const registerIpcHandlers = () => {
  if (handlersRegistered) {
    return;
  }

  ipcMain.handle(IPC_CHANNELS.registry.read, handleRegistryRead);
  ipcMain.handle(IPC_CHANNELS.registry.write, handleRegistryWrite);
  ipcMain.handle(IPC_CHANNELS.keychain.lookup, handleKeychainLookup);
  ipcMain.handle(IPC_CHANNELS.keychain.save, handleKeychainSave);
  ipcMain.handle(IPC_CHANNELS.detection.status, handleDetectionStatus);
  ipcMain.handle(IPC_CHANNELS.detection.refresh, handleDetectionRefresh);
  ipcMain.handle(IPC_CHANNELS.sync.invoke, handleSyncInvoke);
  ipcMain.handle(IPC_CHANNELS.sync.status, handleSyncStatus);
  ipcMain.handle(IPC_CHANNELS.updates.status, handleUpdateStatus);
  ipcMain.handle(IPC_CHANNELS.updates.check, handleUpdateCheck);
  ipcMain.handle(IPC_CHANNELS.updates.preference, handleUpdatePreference);

  void detectionService.refresh().catch((error) => {
    console.error('[relay] Failed to run initial agent detection:', error);
  });

  handlersRegistered = true;
};

export const triggerSyncFromMain = (payload?: SyncInvocationPayload) => syncService.syncNow(payload);

export type { RendererBridge } from './contracts';
