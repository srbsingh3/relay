import type {
  DetectionSummary,
  SyncInvocationPayload,
  SyncInvocationResult,
  SyncStatusSnapshot,
  SyncIssue
} from '../ipc/contracts';
import type { RegistryEnvironmentMap, RegistryFile, RegistryServerRecord } from '../registry/schema';
import { effectiveEnabled, loadRegistry } from '../registry/service';
import type { SupportedAgent } from '../types/agents';
import { SUPPORTED_AGENTS } from '../types/agents';
import { getDetectionService } from '../detection/service';
import { extractAliasFromValue, getKeychainService } from '../keychain/service';
import type { AgentSyncPlan, AgentServerPlan, SyncAdaptersMap } from './types';
import { createDefaultAdapters } from './adapters';
import { SyncAdapterError, createIssueFromAdapterError, createMissingSecretIssue, createIoFailureIssue } from './errors';
import type { RecoveryEligibleCode, SyncRecoveryPrompter } from './recovery';
import { createDefaultRecoveryPrompter } from './recovery';

type DetectionResolver = () => Promise<DetectionSummary>;
type RegistryLoader = () => Promise<RegistryFile>;
type SecretResolver = Pick<ReturnType<typeof getKeychainService>, 'getSecret'>;

export interface SyncServiceOptions {
  adapters?: SyncAdaptersMap;
  registryLoader?: RegistryLoader;
  detectionResolver?: DetectionResolver;
  keychain?: SecretResolver;
  now?: () => Date;
  recoveryPrompter?: SyncRecoveryPrompter;
}

interface NormalizedSyncInvocation {
  source: SyncInvocationPayload['source'];
  apps: SupportedAgent[];
}

type SkipReason = 'undetected' | 'no_servers' | 'error';

interface SkipRecord {
  agent: SupportedAgent;
  reason: SkipReason;
}

interface MissingSecretWarning {
  serverId: string;
  serverName: string;
  envKey: string;
  alias: string;
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
  private readonly keychain: SecretResolver;
  private readonly now: () => Date;
  private readonly recoveryPrompter: SyncRecoveryPrompter;
  private inflight: Promise<SyncInvocationResult> | null = null;
  private status: SyncStatusSnapshot = { state: 'idle', lastRun: null };

  constructor(options: SyncServiceOptions = {}) {
    this.adapters = options.adapters ?? createDefaultAdapters();
    this.registryLoader = options.registryLoader ?? loadRegistry;
    const detectionService = getDetectionService();
    this.detectionResolver = options.detectionResolver ?? (() => detectionService.refresh());
    this.keychain = options.keychain ?? getKeychainService();
    this.now = options.now ?? (() => new Date());
    this.recoveryPrompter = options.recoveryPrompter ?? createDefaultRecoveryPrompter();
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
        this.setStatus({
          state: result.ok ? 'idle' : 'error',
          lastRun: result.finishedAt,
          lastError: result.ok ? undefined : result.message
        });
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
    const { plans, skipped, issues } = await this.buildPlans(payload.apps, registry, detectionSummary);

    const syncedApps: SupportedAgent[] = [];

    for (const plan of plans) {
      const adapter = this.adapters[plan.agent];
      if (!adapter) {
        throw new Error(`No sync adapter registered for ${plan.agent}`);
      }

      try {
        await adapter.sync(plan);
        syncedApps.push(plan.agent);
      } catch (error) {
        const issue = await this.handleAdapterFailure(plan, error);
        issues.push(issue);
        skipped.push({ agent: plan.agent, reason: 'error' });
      } finally {
        this.purgePlanSecrets(plan);
      }
    }

    const finishedAt = this.now().toISOString();
    const message = this.buildMessage(payload, syncedApps, skipped, issues);
    const ok = !issues.some((issue) => issue.severity === 'error');

    return {
      ok,
      syncedApps,
      finishedAt,
      message,
      issues
    };
  }

  private async handleAdapterFailure(plan: AgentSyncPlan, error: unknown): Promise<SyncIssue> {
    let issue: SyncIssue;

    if (error instanceof SyncAdapterError) {
      issue = createIssueFromAdapterError(error);
    } else {
      const fallback = error instanceof Error ? error.message : 'Adapter sync failed';
      const filePath = plan.detection.path ?? undefined;
      issue = createIoFailureIssue(plan.agent, fallback, filePath);
    }

    if (this.shouldPromptForRecovery(issue.code)) {
      const action = await this.recoveryPrompter({
        agent: plan.agent,
        code: issue.code as RecoveryEligibleCode,
        filePath: issue.meta?.filePath ?? plan.detection.path ?? undefined,
        message: issue.message
      });

      if (!issue.meta) {
        issue.meta = {};
      }
      issue.meta.actionTaken = action;
    }

    return issue;
  }

  private async buildPlans(
    apps: SupportedAgent[],
    registry: RegistryFile,
    detection: DetectionSummary
  ): Promise<{ plans: AgentSyncPlan[]; skipped: SkipRecord[]; issues: SyncIssue[] }> {
    const plans: AgentSyncPlan[] = [];
    const skipped: SkipRecord[] = [];
    const issuesMap = new Map<string, SyncIssue>();

    for (const agent of apps) {
      const status = detection[agent];
      if (!status?.detected) {
        skipped.push({ agent, reason: 'undetected' });
        continue;
      }

      const servers = this.collectEffectiveServers(registry.servers, agent);
      if (servers.length === 0) {
        skipped.push({ agent, reason: 'no_servers' });
        continue;
      }

      const resolvedServers: AgentServerPlan[] = [];
      for (const server of servers) {
        const { plan, missing } = await this.prepareServerPlan(server);
        resolvedServers.push(plan);
        missing.forEach((warning) => {
          const key = this.warningKey(warning);
          const existingIssue = issuesMap.get(key);
          if (existingIssue) {
            if (!existingIssue.agents.includes(agent)) {
              existingIssue.agents.push(agent);
            }
            return;
          }

          const issue = createMissingSecretIssue(agent, warning);
          issuesMap.set(key, issue);
        });
      }

      plans.push({
        agent,
        detection: status,
        servers: resolvedServers
      });
    }

    return { plans, skipped, issues: Array.from(issuesMap.values()) };
  }

  private collectEffectiveServers(servers: RegistryServerRecord[], agent: SupportedAgent): RegistryServerRecord[] {
    return servers.filter((server) => effectiveEnabled(server, agent));
  }

  private async prepareServerPlan(server: RegistryServerRecord): Promise<{
    plan: AgentServerPlan;
    missing: MissingSecretWarning[];
  }> {
    const { env, missing } = await this.resolveServerEnv(server);
    return {
      plan: {
        server,
        env
      },
      missing
    };
  }

  private async resolveServerEnv(server: RegistryServerRecord): Promise<{
    env: RegistryEnvironmentMap;
    missing: MissingSecretWarning[];
  }> {
    const resolved: RegistryEnvironmentMap = {};
    const missing: MissingSecretWarning[] = [];
    const envEntries = Object.entries(server.env ?? {});

    for (const [key, value] of envEntries) {
      const alias = extractAliasFromValue(value);
      if (!alias) {
        resolved[key] = value;
        continue;
      }

      let secret: string | null = null;
      try {
        secret = await this.keychain.getSecret(alias);
      } catch {
        secret = null;
      }

      if (secret) {
        resolved[key] = secret;
      } else {
        missing.push({
          serverId: server.id,
          serverName: server.name,
          envKey: key,
          alias
        });
      }
    }

    return { env: resolved, missing };
  }

  private buildMessage(
    payload: NormalizedSyncInvocation,
    synced: SupportedAgent[],
    skipped: SkipRecord[],
    issues: SyncIssue[]
  ): string {
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

    const missingSecrets = this.describeMissingSecretIssues(issues);
    if (missingSecrets) {
      parts.push(`missing secrets: ${missingSecrets}`);
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
    if (reason === 'undetected') {
      return 'undetected';
    }

    if (reason === 'no_servers') {
      return 'no enabled servers';
    }

    return 'error';
  }

  private warningKey(warning: MissingSecretWarning): string {
    return `${warning.serverId}:${warning.envKey}:${warning.alias}`;
  }

  private describeMissingSecretIssues(issues: SyncIssue[]): string | null {
    const descriptions = issues
      .filter((issue) => issue.code === 'ERR_SECRET_MISSING')
      .map((issue) => {
        const server = issue.meta?.serverName ?? 'Server';
        const envKey = issue.meta?.envKey ?? 'value';
        const alias = issue.meta?.alias ?? 'unknown';
        return `${server} ${envKey} (alias ${alias})`;
      });

    return descriptions.length > 0 ? descriptions.join(', ') : null;
  }

  private purgePlanSecrets(plan: AgentSyncPlan) {
    plan.servers.forEach((entry) => {
      entry.env = {};
    });
  }

  private shouldPromptForRecovery(code: SyncIssue['code']): code is RecoveryEligibleCode {
    return code === 'ERR_INVALID_CONFIG' || code === 'ERR_PERMISSION_DENIED';
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
