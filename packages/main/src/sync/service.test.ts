import { describe, expect, it, vi } from 'vitest';

import type { DetectionStatus, DetectionSummary } from '../ipc/contracts';
import type { RegistryFile, RegistryServerRecord } from '../registry/schema';
import type { SupportedAgent } from '../types/agents';
import { SUPPORTED_AGENTS } from '../types/agents';
import type { AgentSyncPlan, SyncAdaptersMap } from './types';
import { SyncService } from './service';

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

    const service = new SyncService({
      adapters,
      registryLoader: async () => registry,
      detectionResolver: async () => detection,
      now: () => new Date('2024-03-01T12:00:00.000Z')
    });

    const result = await service.syncNow({ source: 'user' });

    expect(adapters.cursor.sync).toHaveBeenCalledTimes(1);
    expect(adapters.cursor.sync).toHaveBeenCalledWith({
      agent: 'cursor',
      detection: detection.cursor,
      servers: [registry.servers[0]]
    });

    expect(adapters.claude.sync).toHaveBeenCalledTimes(1);
    expect(adapters.claude.sync).toHaveBeenCalledWith({
      agent: 'claude',
      detection: detection.claude,
      servers: [registry.servers[0]]
    });

    expect(adapters.codex.sync).toHaveBeenCalledTimes(1);
    expect(adapters.codex.sync).toHaveBeenCalledWith({
      agent: 'codex',
      detection: detection.codex,
      servers: [registry.servers[1]]
    });

    expect(result.syncedApps).toEqual(['cursor', 'claude', 'codex']);
    expect(result.finishedAt).toBe('2024-03-01T12:00:00.000Z');
    expect(result.message).toBe('Synced 3 apps');
    expect(service.getStatus()).toEqual({ state: 'idle', lastRun: '2024-03-01T12:00:00.000Z' });
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

    const service = new SyncService({
      adapters,
      registryLoader: async () => registry,
      detectionResolver: async () => detection,
      now: () => new Date('2024-04-10T08:00:00.000Z')
    });

    const result = await service.syncNow();

    expect(result.syncedApps).toEqual(['cursor']);
    expect(result.message).toBe('Synced 1/3 apps; skipped Claude (undetected), Codex (no enabled servers)');
    expect(adapters.cursor.sync).toHaveBeenCalledTimes(1);
    expect(adapters.claude.sync).not.toHaveBeenCalled();
    expect(adapters.codex.sync).not.toHaveBeenCalled();
    expect(service.getStatus()).toEqual({ state: 'idle', lastRun: '2024-04-10T08:00:00.000Z' });
  });

  it('prevents overlapping sync runs and shares the in-flight promise', async () => {
    const registry = createRegistry([createServer()]);
    const detection = buildDetectionSummary({
      cursor: true,
      claude: false,
      codex: false
    });

    let release: (() => void) | null = null;
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

    const service = new SyncService({
      adapters,
      registryLoader: async () => registry,
      detectionResolver: async () => detection,
      now: () => new Date('2024-05-20T18:30:00.000Z')
    });

    const first = service.syncNow({ source: 'user', apps: ['cursor'] });
    const second = service.syncNow({ source: 'tray' });

    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(cursorAdapter.sync).toHaveBeenCalledTimes(1);
    expect(service.getStatus().state).toBe('running');

    release?.();
    const [firstResult, secondResult] = await Promise.all([first, second]);

    expect(firstResult).toEqual(secondResult);
    expect(firstResult.syncedApps).toEqual(['cursor']);
    expect(firstResult.message).toBe('Synced 1 app');
    expect(service.getStatus()).toEqual({ state: 'idle', lastRun: '2024-05-20T18:30:00.000Z' });
  });
});
