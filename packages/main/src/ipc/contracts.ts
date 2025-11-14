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

export type SyncErrorCode = 'ERR_SECRET_MISSING' | 'ERR_PERMISSION_DENIED' | 'ERR_INVALID_CONFIG' | 'ERR_IO_FAILURE';

export type SyncIssueSeverity = 'warning' | 'error';

export type SyncIssueSurface = 'toast' | 'modal' | 'settings';

export type SyncIssueAction = 'open_file' | 'restore_backup' | 'skip_app';

export interface SyncIssueMeta {
  serverId?: string;
  serverName?: string;
  envKey?: string;
  alias?: string;
  filePath?: string;
  actionTaken?: SyncIssueAction;
}

export interface SyncIssue {
  code: SyncErrorCode;
  severity: SyncIssueSeverity;
  message: string;
  agents: SupportedAgent[];
  surfaces: SyncIssueSurface[];
  actions?: SyncIssueAction[];
  meta?: SyncIssueMeta;
}

export interface SyncInvocationResult {
  ok: boolean;
  syncedApps: SupportedAgent[];
  finishedAt: string;
  message?: string;
  issues: SyncIssue[];
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
} as const;

export type IpcChannels = typeof IPC_CHANNELS;

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
    refresh: () => Promise<DetectionSummary>;
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
