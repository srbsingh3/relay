import type { UpdateCheckPayload, UpdateStatusSnapshot } from '../ipc/contracts';

type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;

const DEFAULT_MANIFEST_URL = 'https://updates.relay.app/manifest.json';

export interface UpdateServiceOptions {
  version?: string;
  now?: () => Date;
  manifestUrl?: string;
  fetchImpl?: FetchLike;
}

const coerceManifestVersion = (input: unknown): string | null => {
  if (typeof input === 'string') {
    const trimmed = input.trim();
    return trimmed.length ? trimmed : null;
  }

  return null;
};

const sanitizeMessage = (input: unknown, fallback: string): string => {
  if (typeof input !== 'string') {
    return fallback;
  }

  const trimmed = input.trim();
  if (!trimmed) {
    return fallback;
  }

  return trimmed.slice(0, 280);
};

const compareVersions = (next: string, current: string): number => {
  const segments = (value: string) => value.split('.').map((part) => Number.parseInt(part, 10) || 0);
  const nextParts = segments(next);
  const currentParts = segments(current);
  const length = Math.max(nextParts.length, currentParts.length);

  for (let index = 0; index < length; index += 1) {
    const a = nextParts[index] ?? 0;
    const b = currentParts[index] ?? 0;
    if (a > b) {
      return 1;
    }
    if (a < b) {
      return -1;
    }
  }

  return 0;
};

export class UpdateService {
  private readonly version: string;
  private readonly now: () => Date;
  private readonly manifestUrl: string;
  private readonly fetchImpl: FetchLike | null;
  private status: UpdateStatusSnapshot;

  constructor(options: UpdateServiceOptions = {}) {
    this.version = options.version ?? process.env.npm_package_version ?? '0.0.0';
    this.now = options.now ?? (() => new Date());
    this.manifestUrl = options.manifestUrl ?? process.env.RELAY_UPDATE_MANIFEST_URL ?? DEFAULT_MANIFEST_URL;
    this.fetchImpl = options.fetchImpl ?? (typeof fetch === 'function' ? fetch.bind(globalThis) : null);
    this.status = {
      state: 'idle',
      currentVersion: this.version,
      latestVersion: null,
      checkedAt: null,
      message: 'No update checks have run yet.',
      autoCheckEnabled: true
    };
  }

  async checkForUpdates(payload?: UpdateCheckPayload): Promise<UpdateStatusSnapshot> {
    const checkedAt = this.now().toISOString();

    if (payload?.source === 'auto' && !this.status.autoCheckEnabled) {
      this.status = {
        ...this.status,
        state: 'idle',
        checkedAt,
        message: 'Automatic update checks are disabled.'
      };
      return this.status;
    }

    if (!this.fetchImpl) {
      this.status = {
        ...this.status,
        state: 'offline',
        checkedAt,
        message: 'Update checks are unavailable in this environment.'
      };
      return this.status;
    }

    try {
      const response = await this.fetchImpl(this.manifestUrl, {
        method: 'GET',
        headers: {
          Accept: 'application/json'
        },
        redirect: 'follow',
        referrerPolicy: 'no-referrer',
        cache: 'no-store',
        credentials: 'omit'
      });

      if (!response.ok) {
        throw new Error(`Manifest request failed with status ${response.status}`);
      }

      const manifest = (await response.json().catch(() => ({}))) as Record<string, unknown>;
      const latestVersion = coerceManifestVersion(manifest.version) ?? this.version;
      const hasUpdate = compareVersions(latestVersion, this.version) > 0;
      const fallbackMessage = hasUpdate ? 'A new Relay update is available.' : 'Relay is up to date.';

      this.status = {
        ...this.status,
        state: hasUpdate ? 'update_available' : 'up_to_date',
        latestVersion,
        checkedAt,
        message: sanitizeMessage(manifest.message, fallbackMessage)
      };
    } catch (error) {
      const offline = (error as NodeJS.ErrnoException)?.code === 'ENOTFOUND';
      console.error('[relay] update check failed:', error);
      this.status = {
        ...this.status,
        state: offline ? 'offline' : 'error',
        checkedAt,
        message: offline ? 'Unable to reach the update server.' : 'Unable to check for updates.'
      };
    }

    return this.status;
  }

  getStatus(): UpdateStatusSnapshot {
    return this.status;
  }

  setAutoCheckEnabled(enabled: boolean): UpdateStatusSnapshot {
    this.status = {
      ...this.status,
      autoCheckEnabled: enabled
    };
    return this.status;
  }
}

const defaultService = new UpdateService();

export const getUpdateService = () => defaultService;
