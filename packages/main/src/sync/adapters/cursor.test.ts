import { mkdtemp, readFile, stat, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { beforeEach, describe, expect, it } from 'vitest';

import type { DetectionStatus } from '../../ipc/contracts';
import type { RegistryServerRecord } from '../../registry/schema';
import type { SupportedAgent } from '../../types/agents';
import type { AgentServerPlan, AgentSyncPlan } from '../types';
import { createCursorAdapter } from './cursor';
import { createClaudeAdapter } from './claude';

const detectionStatus = (configPath: string): DetectionStatus => ({
  detected: true,
  path: configPath,
  lastChecked: new Date('2024-01-01T00:00:00.000Z').toISOString()
});

const createServerRecord = (overrides?: Partial<RegistryServerRecord>): RegistryServerRecord => ({
  id: overrides?.id ?? 'srv_context7',
  name: overrides?.name ?? 'Context7',
  enabled: overrides?.enabled ?? true,
  launch:
    overrides?.launch ??
    ({
      mode: 'command',
      command: overrides?.launch?.command ?? 'context7-mcp',
      args: overrides?.launch?.args ?? []
    } as RegistryServerRecord['launch']),
  env: overrides?.env ?? {},
  apps: overrides?.apps
});

const createServerPlan = (overrides?: Partial<AgentServerPlan>): AgentServerPlan => ({
  server: overrides?.server ?? createServerRecord(),
  env: overrides?.env ?? {}
});

const createPlan = (agent: SupportedAgent, configPath: string, servers: AgentServerPlan[]): AgentSyncPlan => ({
  agent,
  detection: detectionStatus(configPath),
  servers
});

const RELAY_META_KEY = '__relayManagedServers';

let workspaceDir: string;

const tempFile = (name: string) => path.join(workspaceDir, name);

beforeEach(async () => {
  workspaceDir = await mkdtemp(path.join(os.tmpdir(), 'relay-json-adapter-'));
});

const readConfig = async (filePath: string): Promise<Record<string, any>> =>
  JSON.parse(await readFile(filePath, 'utf8'));

const ADAPTER_MATRIX = [
  {
    label: 'Cursor',
    agent: 'cursor' as SupportedAgent,
    factory: createCursorAdapter
  },
  {
    label: 'Claude',
    agent: 'claude' as SupportedAgent,
    factory: createClaudeAdapter
  }
];

describe.each(ADAPTER_MATRIX)('$label adapter', ({ agent, factory }) => {
  it('writes a fresh config when no file exists', async () => {
    const configPath = tempFile(`${agent}.json`);
    const plan = createPlan(agent, configPath, [
      createServerPlan({
        server: createServerRecord({
          id: 'srv_context',
          name: 'Context7',
          launch: {
            mode: 'command',
            command: 'context7-mcp',
            args: []
          }
        }),
        env: { CONTEXT7_API_KEY: 'top-secret' }
      })
    ]);

    const adapter = factory();
    await adapter.sync(plan);

    const config = await readConfig(configPath);
    expect(config.mcpServers).toMatchObject({
      Context7: {
        command: 'context7-mcp',
        args: [],
        env: { CONTEXT7_API_KEY: 'top-secret' }
      }
    });
    expect(config[RELAY_META_KEY]).toEqual({ srv_context: 'Context7' });
  });

  it('merges with existing configs, preserving unrelated fields and entries', async () => {
    const configPath = tempFile(`${agent}.json`);
    const existing = {
      mcpServers: {
        Legacy: {
          command: 'legacy',
          args: ['--path', '/tmp'],
          env: { LEGACY_TOKEN: 'foo' }
        }
      },
      theme: 'dark'
    };
    await writeFile(configPath, `${JSON.stringify(existing, null, 2)}\n`, 'utf8');

    const plan = createPlan(agent, configPath, [
      createServerPlan({
        server: createServerRecord({
          id: 'srv_workspace',
          name: 'Workspace',
          launch: {
            mode: 'command',
            command: 'relay-workspace',
            args: ['--flag']
          }
        }),
        env: { WORKSPACE_TOKEN: 'abc123' }
      })
    ]);

    const adapter = factory();
    await adapter.sync(plan);

    const config = await readConfig(configPath);
    expect(config.mcpServers).toMatchObject({
      Legacy: existing.mcpServers.Legacy,
      Workspace: {
        command: 'relay-workspace',
        args: ['--flag'],
        env: { WORKSPACE_TOKEN: 'abc123' }
      }
    });
    expect(config.theme).toBe('dark');
    expect(config[RELAY_META_KEY]).toEqual({ srv_workspace: 'Workspace' });

    const backup = await readFile(`${configPath}.bak`, 'utf8');
    expect(backup).toContain('"Legacy"');
    expect(backup).toContain('"theme": "dark"');
  });

  it('removes Relay-managed servers that are no longer in the plan', async () => {
    const configPath = tempFile(`${agent}.json`);
    const existing = {
      mcpServers: {
        Legacy: {
          command: 'legacy',
          args: [],
          env: {}
        },
        Stale: {
          command: 'stale',
          args: [],
          env: {}
        }
      },
      [RELAY_META_KEY]: {
        srv_stale: 'Stale'
      }
    };
    await writeFile(configPath, `${JSON.stringify(existing, null, 2)}\n`, 'utf8');

    const plan = createPlan(agent, configPath, []);

    const adapter = factory();
    await adapter.sync(plan);

    const config = await readConfig(configPath);
    expect(config.mcpServers).toEqual({
      Legacy: existing.mcpServers.Legacy
    });
    expect(config).not.toHaveProperty(RELAY_META_KEY);
    await expect(stat(`${configPath}.bak`)).resolves.toBeDefined();
  });

  it('rejects invalid JSON rather than overwriting the file', async () => {
    const configPath = tempFile(`${agent}.json`);
    await writeFile(configPath, '{invalid', 'utf8');

    const plan = createPlan(agent, configPath, [
      createServerPlan({
        server: createServerRecord({
          id: 'srv_error',
          name: 'Broken'
        }),
        env: {}
      })
    ]);

    const adapter = factory();
    await expect(adapter.sync(plan)).rejects.toThrow('invalid JSON');
  });
});
