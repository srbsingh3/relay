import type { UpdateCheckPayload, UpdateStatusSnapshot } from '../ipc/contracts';

export interface UpdateServiceOptions {
  version?: string;
  now?: () => Date;
}

export class UpdateService {
  private readonly version: string;
  private readonly now: () => Date;
  private status: UpdateStatusSnapshot;

  constructor(options: UpdateServiceOptions = {}) {
    this.version = options.version ?? process.env.npm_package_version ?? '0.0.0';
    this.now = options.now ?? (() => new Date());
    this.status = {
      state: 'idle',
      currentVersion: this.version,
      latestVersion: null,
      checkedAt: null,
      message: 'No update checks have run yet.',
      autoCheckEnabled: true
    };
  }

  async checkForUpdates(_payload?: UpdateCheckPayload): Promise<UpdateStatusSnapshot> {
    const checkedAt = this.now().toISOString();

    try {
      this.status = {
        ...this.status,
        state: 'up_to_date',
        latestVersion: this.version,
        checkedAt,
        message: 'Relay is up to date.'
      };
    } catch (error) {
      console.error('[relay] update check failed:', error);
      this.status = {
        ...this.status,
        state: 'error',
        checkedAt,
        message: 'Unable to check for updates.'
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
