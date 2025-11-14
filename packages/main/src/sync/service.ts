import type { DetectionSummary, SyncInvocationPayload, SyncInvocationResult, SyncStatusSnapshot } from '../ipc/contracts';
import type { RegistryFile, RegistryServerRecord } from '../registry/schema';
import { effectiveEnabled, loadRegistry } from '../registry/service';
import type { SupportedAgent } from '../types/agents';
import { SUPPORTED_AGENTS } from '../types/agents';
import { getDetectionService } from '../detection/service';
import type { AgentSyncPlan, SyncAdaptersMap } from './types';
import { createDefaultAdapters } from './adapters';

type DetectionResolver = () => Promise<DetectionSummary>;
type RegistryLoader = () => Promise<RegistryFile>;

export interface SyncServiceOptions {
  adapters?: SyncAdaptersMap;
  registryLoader?: RegistryLoader;
  detectionResolver?: DetectionResolver;
  now?: () => Date;
}

interface NormalizedSyncInvocation {
  source: SyncInvocationPayload['source'];
  apps: SupportedAgent[];
}

type SkipReason = 'undetected' | 'no_servers';

interface SkipRecord {
  agent: SupportedAgent;
  reason: SkipReason;
}

const AGENT_LABELS: Record<SupportedAgent, string> = {
  cursor: 'Cursor',
  claude: 'Claude',
  codex: 'Codex'
};

const SOURCE_LABELS: Record<SyncInvocationPayload['source'], string> = {
  user: 'app',
  tray: 'tray',
  schedule: 'scheduler'
};

export class SyncService {
  private readonly adapters: SyncAdaptersMap;
  private readonly registryLoader: RegistryLoader;
  private readonly detectionResolver: DetectionResolver;
  private readonly now: () => Date;
  private inflight: Promise<SyncInvocationResult> | null = null;
  private status: SyncStatusSnapshot = { state: 'idle', lastRun: null };

  constructor(options: SyncServiceOptions = {}) {
    this.adapters = options.adapters ?? createDefaultAdapters();
    this.registryLoader = options.registryLoader ?? loadRegistry;
    const detectionService = getDetectionService();
    this.detectionResolver = options.detectionResolver ?? (() => detectionService.refresh());
    this.now = options.now ?? (() => new Date());
  }

  getStatus(): SyncStatusSnapshot {
    return { ...this.status };
  }

  async syncNow(payload?: SyncInvocationPayload): Promise<SyncInvocationResult> {
    if (this.inflight) {
      return this.inflight;
    }

    const normalized = this.normalizePayload(payload);
    this.setStatus({ state: 'running', lastRun: this.status.lastRun ?? null });

    const run = this.executeSync(normalized)
      .then((result) => {
        this.setStatus({ state: 'idle', lastRun: result.finishedAt });
        return result;
      })
      .catch((error) => {
        const message = error instanceof Error ? error.message : 'Sync failed';
        this.setStatus({
          state: 'error',
          lastRun: this.status.lastRun ?? null,
          lastError: message
        });
        throw error;
      })
      .finally(() => {
        this.inflight = null;
      });

    this.inflight = run;
    return run;
  }

  private normalizePayload(payload?: SyncInvocationPayload): NormalizedSyncInvocation {
    const apps = this.normalizeAgents(payload?.apps);
    return {
      source: payload?.source ?? 'user',
      apps
    };
  }

  private normalizeAgents(apps?: SupportedAgent[]): SupportedAgent[] {
    if (!apps || apps.length === 0) {
      return [...SUPPORTED_AGENTS];
    }

    const seen = new Set<SupportedAgent>();
    const filtered: SupportedAgent[] = [];

    apps.forEach((agent) => {
      if (!SUPPORTED_AGENTS.includes(agent)) {
        return;
      }

      if (!seen.has(agent)) {
        seen.add(agent);
        filtered.push(agent);
      }
    });

    return filtered.length > 0 ? filtered : [...SUPPORTED_AGENTS];
  }

  private async executeSync(payload: NormalizedSyncInvocation): Promise<SyncInvocationResult> {
    const [registry, detectionSummary] = await Promise.all([this.registryLoader(), this.detectionResolver()]);
    const { plans, skipped } = this.buildPlans(payload.apps, registry, detectionSummary);

    const syncedApps: SupportedAgent[] = [];

    for (const plan of plans) {
      const adapter = this.adapters[plan.agent];
      if (!adapter) {
        throw new Error(`No sync adapter registered for ${plan.agent}`);
      }

      await adapter.sync(plan);
      syncedApps.push(plan.agent);
    }

    const finishedAt = this.now().toISOString();
    const message = this.buildMessage(payload, syncedApps, skipped);

    return {
      ok: true,
      syncedApps,
      finishedAt,
      message
    };
  }

  private buildPlans(apps: SupportedAgent[], registry: RegistryFile, detection: DetectionSummary) {
    const plans: AgentSyncPlan[] = [];
    const skipped: SkipRecord[] = [];

    apps.forEach((agent) => {
      const status = detection[agent];
      if (!status?.detected) {
        skipped.push({ agent, reason: 'undetected' });
        return;
      }

      const servers = this.collectEffectiveServers(registry.servers, agent);
      if (servers.length === 0) {
        skipped.push({ agent, reason: 'no_servers' });
        return;
      }

      plans.push({
        agent,
        detection: status,
        servers
      });
    });

    return { plans, skipped };
  }

  private collectEffectiveServers(servers: RegistryServerRecord[], agent: SupportedAgent): RegistryServerRecord[] {
    return servers.filter((server) => effectiveEnabled(server, agent));
  }

  private buildMessage(payload: NormalizedSyncInvocation, synced: SupportedAgent[], skipped: SkipRecord[]): string {
    const totalRequested = payload.apps.length;
    const countLabel = this.describeCount(synced.length, totalRequested);
    const parts = [`Synced ${countLabel}`];

    if (skipped.length > 0) {
      const skippedDetails = skipped
        .map(({ agent, reason }) => `${AGENT_LABELS[agent]} (${this.describeSkipReason(reason)})`)
        .join(', ');
      parts.push(`skipped ${skippedDetails}`);
    }

    if (payload.source !== 'user') {
      parts.push(`via ${SOURCE_LABELS[payload.source]}`);
    }

    return parts.join('; ');
  }

  private describeCount(synced: number, requested: number): string {
    const plural = requested === 1 ? 'app' : 'apps';
    if (requested === 0 || synced === requested) {
      return `${synced} ${plural}`;
    }

    return `${synced}/${requested} ${plural}`;
  }

  private describeSkipReason(reason: SkipReason): string {
    return reason === 'undetected' ? 'undetected' : 'no enabled servers';
  }

  private setStatus(next: SyncStatusSnapshot) {
    const snapshot: SyncStatusSnapshot = {
      state: next.state,
      lastRun: next.lastRun
    };

    if (typeof next.lastError === 'string') {
      snapshot.lastError = next.lastError;
    }

    this.status = snapshot;
  }
}

const defaultService = new SyncService();

export const getSyncService = () => defaultService;
