import type { RegistryServerRecord, RegistryFile } from '../registry/schema';
import type { SupportedAgent } from '../types/agents';

export type RegistryServerEntry = RegistryServerRecord;

export type RegistrySnapshot = RegistryFile;

export interface RegistryWritePayload {
  snapshot: RegistrySnapshot;
}

export interface KeychainLookupPayload {
  alias: string;
}

export interface KeychainLookupResult {
  alias: string;
  hasSecret: boolean;
  updatedAt: string | null;
}

export interface KeychainSavePayload {
  alias: string;
  secret: string;
}

export interface KeychainSaveResult {
  ok: boolean;
  error?: string;
}

export interface DetectionStatus {
  detected: boolean;
  path: string | null;
  lastChecked: string;
}

export interface DetectionSummary {
  cursor: DetectionStatus;
  claude: DetectionStatus;
  codex: DetectionStatus;
}

export interface SyncInvocationPayload {
  source: 'user' | 'tray' | 'schedule';
  apps?: SupportedAgent[];
}

export interface SyncInvocationResult {
  ok: boolean;
  syncedApps: SupportedAgent[];
  finishedAt: string;
  message?: string;
}

export interface SyncStatusSnapshot {
  state: 'idle' | 'running' | 'error';
  lastRun: string | null;
  lastError?: string;
}

export type UpdateState = 'idle' | 'checking' | 'up_to_date' | 'update_available' | 'offline' | 'error';

export interface UpdateStatusSnapshot {
  state: UpdateState;
  currentVersion: string;
  latestVersion: string | null;
  checkedAt: string | null;
  message: string | null;
  autoCheckEnabled: boolean;
}

export interface UpdateCheckPayload {
  source: 'manual' | 'auto';
}

export interface UpdatePreferencePayload {
  autoCheckEnabled: boolean;
}

export const IPC_CHANNELS = {
  registry: {
    read: 'relay:registry:read',
    write: 'relay:registry:write'
  },
  keychain: {
    lookup: 'relay:keychain:lookup',
    save: 'relay:keychain:save'
  },
  detection: {
    status: 'relay:detection:status'
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
} as const;

export interface RendererBridge {
  version: string;
  registry: {
    read: () => Promise<RegistrySnapshot>;
    write: (payload: RegistryWritePayload) => Promise<RegistrySnapshot>;
  };
  keychain: {
    lookup: (payload: KeychainLookupPayload) => Promise<KeychainLookupResult>;
    save: (payload: KeychainSavePayload) => Promise<KeychainSaveResult>;
  };
  detection: {
    status: () => Promise<DetectionSummary>;
  };
  sync: {
    invoke: (payload: SyncInvocationPayload) => Promise<SyncInvocationResult>;
    status: () => Promise<SyncStatusSnapshot>;
  };
  updates: {
    status: () => Promise<UpdateStatusSnapshot>;
    check: (payload: UpdateCheckPayload) => Promise<UpdateStatusSnapshot>;
    preference: (payload: UpdatePreferencePayload) => Promise<UpdateStatusSnapshot>;
  };
}

export type { SupportedAgent } from '../types/agents';
