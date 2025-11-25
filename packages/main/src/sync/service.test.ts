import { describe, expect, it, vi } from 'vitest';

import type { DetectionStatus, DetectionSummary, SyncIssueAction } from '../ipc/contracts';
import type { RegistryFile, RegistryServerRecord } from '../registry/schema';
import type { SupportedAgent } from '../types/agents';
import { SUPPORTED_AGENTS } from '../types/agents';
import type { AgentSyncPlan, SyncAdaptersMap } from './types';
import { SyncService } from './service';
import { SyncAdapterError } from './errors';

const iso = (value: string) => new Date(value).toISOString();

const buildDetectionStatus = (detected: boolean): DetectionStatus => ({
  detected,
  path: '/mock/path',
  lastChecked: iso('2024-01-01T00:00:00.000Z')
});

const buildDetectionSummary = (detected: Partial<Record<SupportedAgent, boolean>>): DetectionSummary =>
  SUPPORTED_AGENTS.reduce<DetectionSummary>((acc, agent) => {
    acc[agent] = buildDetectionStatus(Boolean(detected[agent]));
    return acc;
  }, {} as DetectionSummary);

const createRegistry = (servers: RegistryServerRecord[]): RegistryFile => ({
  version: 1,
  servers
});

const createAdapter = (agent: SupportedAgent, impl?: (plan: AgentSyncPlan) => Promise<void>) => {
  const syncImpl =
    impl ??
    (async () => {
      // no-op
    });

  const sync = vi.fn(async (plan: AgentSyncPlan) => syncImpl(plan));

  return {
    agent,
    sync
  };
};

const createAdapterMap = (overrides?: Partial<SyncAdaptersMap>): SyncAdaptersMap => {
  const base = {
    cursor: createAdapter('cursor'),
    claude: createAdapter('claude'),
    codex: createAdapter('codex')
  } satisfies SyncAdaptersMap;

  return {
    ...base,
    ...overrides
  };
};

const createServer = (overrides?: Partial<RegistryServerRecord>): RegistryServerRecord => ({
  id: overrides?.id ?? 'srv_test',
  name: overrides?.name ?? 'Test Server',
  enabled: overrides?.enabled ?? true,
  launch: overrides?.launch ?? {
    mode: 'command',
    command: 'relay serve',
    args: []
  },
  env: overrides?.env ?? {},
  apps: overrides?.apps
});

const createKeychain = (secrets?: Record<string, string | null>) => {
  const store = secrets ?? {};
  return {
    getSecret: vi.fn(async (alias: string) => {
      if (Object.prototype.hasOwnProperty.call(store, alias)) {
        return store[alias] ?? null;
      }
      return null;
    })
  };
};

const createPrompter = () => vi.fn(async (): Promise<SyncIssueAction> => 'skip_app');

describe('SyncService', () => {
  it('invokes adapters with effective servers for each detected agent', async () => {
    const registry = createRegistry([
      createServer({
        id: 'srv_workspace',
        name: 'Workspace',
        apps: { codex: false }
      }),
      createServer({
        id: 'srv_codex',
        name: 'Codex Only',
        apps: { cursor: false, claude: false }
      })
    ]);

    const detection = buildDetectionSummary({
      cursor: true,
      claude: true,
      codex: true
    });

    const adapters = createAdapterMap();
    const keychain = createKeychain();
    const prompter = createPrompter();

    const service = new SyncService({
      adapters,
      registryLoader: async () => registry,
      detectionResolver: async () => detection,
      keychain,
      now: () => new Date('2024-03-01T12:00:00.000Z'),
      recoveryPrompter: prompter
    });

    const result = await service.syncNow({ source: 'user' });

    expect(adapters.cursor.sync).toHaveBeenCalledTimes(1);
    expect(adapters.cursor.sync).toHaveBeenCalledWith({
      agent: 'cursor',
      detection: detection.cursor,
      servers: [
        {
          server: registry.servers[0],
          env: {}
        }
      ]
    });

    expect(adapters.claude.sync).toHaveBeenCalledTimes(1);
    expect(adapters.claude.sync).toHaveBeenCalledWith({
      agent: 'claude',
      detection: detection.claude,
      servers: [
        {
          server: registry.servers[0],
          env: {}
        }
      ]
    });

    expect(adapters.codex.sync).toHaveBeenCalledTimes(1);
    expect(adapters.codex.sync).toHaveBeenCalledWith({
      agent: 'codex',
      detection: detection.codex,
      servers: [
        {
          server: registry.servers[1],
          env: {}
        }
      ]
    });

    expect(result.syncedApps).toEqual(['cursor', 'claude', 'codex']);
    expect(result.ok).toBe(true);
    expect(result.issues).toEqual([]);
    expect(result.finishedAt).toBe('2024-03-01T12:00:00.000Z');
    expect(result.message).toBe('Synced 3 apps');
    expect(service.getStatus()).toEqual({ state: 'idle', lastRun: '2024-03-01T12:00:00.000Z' });
    expect(prompter).not.toHaveBeenCalled();
  });

  it('skips undetected or server-less agents and reports partial counts', async () => {
    const registry = createRegistry([
      createServer({
        id: 'srv_workspace',
        apps: { codex: false }
      })
    ]);

    const detection = buildDetectionSummary({
      cursor: true,
      claude: false,
      codex: true
    });

    const adapters = createAdapterMap();
    const keychain = createKeychain();
    const prompter = createPrompter();

    const service = new SyncService({
      adapters,
      registryLoader: async () => registry,
      detectionResolver: async () => detection,
      keychain,
      now: () => new Date('2024-04-10T08:00:00.000Z'),
      recoveryPrompter: prompter
    });

    const result = await service.syncNow();

    expect(result.syncedApps).toEqual(['cursor']);
    expect(result.ok).toBe(true);
    expect(result.issues).toEqual([]);
    expect(result.message).toBe('Synced 1/3 apps; skipped Claude (undetected), Codex (no enabled servers)');
    expect(adapters.cursor.sync).toHaveBeenCalledTimes(1);
    expect(adapters.claude.sync).not.toHaveBeenCalled();
    expect(adapters.codex.sync).not.toHaveBeenCalled();
    expect(service.getStatus()).toEqual({ state: 'idle', lastRun: '2024-04-10T08:00:00.000Z' });
    expect(prompter).not.toHaveBeenCalled();
  });

  it('prevents overlapping sync runs and shares the in-flight promise', async () => {
    const registry = createRegistry([createServer()]);
    const detection = buildDetectionSummary({
      cursor: true,
      claude: false,
      codex: false
    });

    let release: ((value?: any) => void) | null = null;
    const cursorAdapter = {
      agent: 'cursor' as const,
      sync: vi.fn(
        () =>
          new Promise<void>((resolve) => {
            release = resolve;
          })
      )
    };

    const adapters = createAdapterMap({
      cursor: cursorAdapter
    });
    const keychain = createKeychain();
    const prompter = createPrompter();

    const service = new SyncService({
      adapters,
      registryLoader: async () => registry,
      detectionResolver: async () => detection,
      keychain,
      now: () => new Date('2024-05-20T18:30:00.000Z'),
      recoveryPrompter: prompter
    });

    const first = service.syncNow({ source: 'user', apps: ['cursor'] });
    const second = service.syncNow({ source: 'tray' });

    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(cursorAdapter.sync).toHaveBeenCalledTimes(1);
    expect(service.getStatus().state).toBe('running');

    (release as any)?.();
    const [firstResult, secondResult] = await Promise.all([first, second]);

    expect(firstResult).toEqual(secondResult);
    expect(firstResult.syncedApps).toEqual(['cursor']);
    expect(firstResult.ok).toBe(true);
    expect(firstResult.issues).toEqual([]);
    expect(firstResult.message).toBe('Synced 1 app');
    expect(service.getStatus()).toEqual({ state: 'idle', lastRun: '2024-05-20T18:30:00.000Z' });
    expect(prompter).not.toHaveBeenCalled();
  });

  it('resolves keychain-referenced env vars before invoking adapters', async () => {
    const registry = createRegistry([
      createServer({
        env: {
          API_KEY: 'keychain:workspace_api',
          MODE: 'debug'
        }
      })
    ]);

    const detection = buildDetectionSummary({
      cursor: true,
      claude: false,
      codex: false
    });

    const keychain = createKeychain({
      workspace_api: 'super-secret'
    });

    const capturedEnv: Record<string, string>[] = [];
    const cursorAdapter = createAdapter('cursor', async (plan) => {
      plan.servers.forEach((entry) => {
        capturedEnv.push({ ...entry.env });
      });
    });

    const adapters = createAdapterMap({
      cursor: cursorAdapter
    });
    const prompter = createPrompter();

    const service = new SyncService({
      adapters,
      registryLoader: async () => registry,
      detectionResolver: async () => detection,
      keychain,
      now: () => new Date('2024-06-15T10:00:00.000Z'),
      recoveryPrompter: prompter
    });

    const result = await service.syncNow({ source: 'user', apps: ['cursor'] });

    expect(result.syncedApps).toEqual(['cursor']);
    expect(capturedEnv).toEqual([{ API_KEY: 'super-secret', MODE: 'debug' }]);
    expect(keychain.getSecret).toHaveBeenCalledWith('workspace_api');
    expect(result.message).toBe('Synced 1 app');
    expect(result.issues).toEqual([]);
    expect(result.ok).toBe(true);
    expect(prompter).not.toHaveBeenCalled();
  });

  it('omits env vars when secrets are missing and surfaces warnings once', async () => {
    const registry = createRegistry([
      createServer({
        name: 'Workspace',
        env: {
          API_KEY: 'keychain:missing_api',
          FALLBACK: '1'
        }
      })
    ]);

    const detection = buildDetectionSummary({
      cursor: true,
      claude: true,
      codex: false
    });

    const keychain = createKeychain();
    const capturedEnv: Record<string, string>[] = [];
    const cursorAdapter = createAdapter('cursor', async (plan) => {
      plan.servers.forEach((entry) => {
        capturedEnv.push({ ...entry.env });
      });
    });

    const adapters = createAdapterMap({
      cursor: cursorAdapter
    });
    const prompter = createPrompter();

    const service = new SyncService({
      adapters,
      registryLoader: async () => registry,
      detectionResolver: async () => detection,
      keychain,
      now: () => new Date('2024-07-01T09:30:00.000Z'),
      recoveryPrompter: prompter
    });

    const result = await service.syncNow();

    expect(result.syncedApps).toEqual(['cursor', 'claude']);
    expect(capturedEnv).toEqual([{ FALLBACK: '1' }]);
    expect(result.message).toBe(
      'Synced 2/3 apps; skipped Codex (undetected); missing secrets: Workspace API_KEY (alias missing_api)'
    );
    expect(result.ok).toBe(true);
    expect(result.issues).toHaveLength(1);
    expect(result.issues[0].code).toBe('ERR_SECRET_MISSING');
    expect(result.issues[0].agents).toEqual(expect.arrayContaining(['cursor', 'claude']));
    expect(prompter).not.toHaveBeenCalled();
  });

  it('captures adapter failures, prompts for recovery, and marks the run as partial', async () => {
    const registry = createRegistry([createServer({ id: 'srv_workspace', name: 'Workspace' })]);
    const detection = buildDetectionSummary({
      cursor: true,
      claude: false,
      codex: false
    });

    const adapters = createAdapterMap({
      cursor: createAdapter('cursor', async () => {
        throw new SyncAdapterError({
          agent: 'cursor',
          code: 'ERR_INVALID_CONFIG',
          message: 'Cursor config is invalid.',
          filePath: '/tmp/mcp.json'
        });
      })
    });

    const keychain = createKeychain();
    const prompter = vi.fn(async (): Promise<SyncIssueAction> => 'restore_backup');

    const service = new SyncService({
      adapters,
      registryLoader: async () => registry,
      detectionResolver: async () => detection,
      keychain,
      now: () => new Date('2024-07-15T16:00:00.000Z'),
      recoveryPrompter: prompter
    });

    const result = await service.syncNow({ source: 'user', apps: ['cursor'] });

    expect(result.ok).toBe(false);
    expect(result.syncedApps).toEqual([]);
    expect(result.issues).toHaveLength(1);
    expect(result.issues[0].code).toBe('ERR_INVALID_CONFIG');
    expect(result.issues[0].meta?.actionTaken).toBe('restore_backup');
    expect(result.message).toContain('skipped Cursor (error)');
    expect(service.getStatus()).toEqual({
      state: 'error',
      lastRun: '2024-07-15T16:00:00.000Z',
      lastError: result.message
    });
    expect(prompter).toHaveBeenCalledTimes(1);
  });
});
