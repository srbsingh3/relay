import type {
  SyncErrorCode,
  SyncIssue,
  SyncIssueAction,
  SyncIssueSurface
} from '../ipc/contracts';
import type { SupportedAgent } from '../types/agents';

export type AdapterErrorCode = Exclude<SyncErrorCode, 'ERR_SECRET_MISSING'>;

export interface MissingSecretIssueDetails {
  serverId: string;
  serverName: string;
  envKey: string;
  alias: string;
}

const SURFACE_MAP: Record<SyncErrorCode, SyncIssueSurface[]> = {
  ERR_SECRET_MISSING: ['toast', 'settings'],
  ERR_PERMISSION_DENIED: ['modal', 'settings'],
  ERR_INVALID_CONFIG: ['modal', 'settings'],
  ERR_IO_FAILURE: ['toast', 'settings']
};

const ACTION_MAP: Partial<Record<SyncErrorCode, SyncIssueAction[]>> = {
  ERR_PERMISSION_DENIED: ['open_file', 'restore_backup', 'skip_app'],
  ERR_INVALID_CONFIG: ['open_file', 'restore_backup', 'skip_app']
};

export const isFsPermissionError = (error: unknown): boolean => {
  const code = (error as NodeJS.ErrnoException)?.code;
  return code === 'EACCES' || code === 'EPERM';
};

interface SyncAdapterErrorOptions {
  agent: SupportedAgent;
  code: AdapterErrorCode;
  message: string;
  filePath?: string;
  cause?: unknown;
}

export class SyncAdapterError extends Error {
  readonly agent: SupportedAgent;
  readonly code: AdapterErrorCode;
  readonly filePath?: string;

  constructor(options: SyncAdapterErrorOptions) {
    super(options.message);
    this.name = 'SyncAdapterError';
    this.agent = options.agent;
    this.code = options.code;
    this.filePath = options.filePath;
    if (options.cause) {
      (this as Error & { cause?: unknown }).cause = options.cause;
    }
  }
}

export const createMissingSecretIssue = (
  agent: SupportedAgent,
  details: MissingSecretIssueDetails
): SyncIssue => ({
  code: 'ERR_SECRET_MISSING',
  severity: 'warning',
  message: `${details.serverName} ${details.envKey} (alias ${details.alias})`,
  agents: [agent],
  surfaces: SURFACE_MAP.ERR_SECRET_MISSING,
  meta: {
    serverId: details.serverId,
    serverName: details.serverName,
    envKey: details.envKey,
    alias: details.alias
  }
});

export const createIssueFromAdapterError = (error: SyncAdapterError): SyncIssue => ({
  code: error.code,
  severity: 'error',
  message: error.message,
  agents: [error.agent],
  surfaces: SURFACE_MAP[error.code],
  actions: ACTION_MAP[error.code],
  meta: {
    filePath: error.filePath
  }
});

export const createIoFailureIssue = (agent: SupportedAgent, message: string, filePath?: string): SyncIssue => ({
  code: 'ERR_IO_FAILURE',
  severity: 'error',
  message,
  agents: [agent],
  surfaces: SURFACE_MAP.ERR_IO_FAILURE,
  meta: filePath ? { filePath } : undefined
});
