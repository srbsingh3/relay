export type SupportedAgent = 'cursor' | 'claude' | 'codex';

export interface RegistryServerEntry {
  id: string;
  label: string;
  alias: string;
  apps: Record<SupportedAgent, boolean>;
  createdAt: string;
  updatedAt: string;
}

export interface RegistrySnapshot {
  version: number;
  servers: RegistryServerEntry[];
  lastUpdated: string;
}

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

export const IPC_CHANNELS = {
  registry: {
    read: 'relay:registry:read',
    write: 'relay:registry:write'
  },
  keychain: {
    lookup: 'relay:keychain:lookup'
  },
  detection: {
    status: 'relay:detection:status'
  },
  sync: {
    invoke: 'relay:sync:invoke',
    status: 'relay:sync:status'
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
  };
  detection: {
    status: () => Promise<DetectionSummary>;
  };
  sync: {
    invoke: (payload: SyncInvocationPayload) => Promise<SyncInvocationResult>;
    status: () => Promise<SyncStatusSnapshot>;
  };
}
