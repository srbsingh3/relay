import { parse as parseToml } from '@iarna/toml';
import { mkdtemp, readFile, stat, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { beforeEach, describe, expect, it } from 'vitest';

import type { DetectionStatus } from '../../ipc/contracts';
import type { RegistryServerRecord } from '../../registry/schema';
import type { AgentServerPlan, AgentSyncPlan } from '../types';
import { createCodexAdapter } from './codex';

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

const createPlan = (configPath: string, servers: AgentServerPlan[]): AgentSyncPlan => ({
  agent: 'codex',
  detection: detectionStatus(configPath),
  servers
});

let workspaceDir: string;

const tempFile = (name: string) => path.join(workspaceDir, name);

beforeEach(async () => {
  workspaceDir = await mkdtemp(path.join(os.tmpdir(), 'relay-codex-'));
});

const parseConfig = async (filePath: string) => parseToml(await readFile(filePath, 'utf8')) as Record<string, any>;

describe('Codex adapter', () => {
  it('writes a fresh config with Relay-managed metadata', async () => {
    const configPath = tempFile('config.toml');
    const plan = createPlan(configPath, [
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
        env: { CONTEXT7_API_KEY: 'secret' }
      })
    ]);

    const adapter = createCodexAdapter();
    await adapter.sync(plan);

    const config = await parseConfig(configPath);
    expect(config.mcp_servers.Context7).toMatchObject({
      command: 'context7-mcp',
      args: [],
      env: { CONTEXT7_API_KEY: 'secret' }
    });
    expect(config.relay.managed_servers).toEqual({ srv_context: 'Context7' });
  });

  it('merges with existing config and preserves unrelated sections', async () => {
    const configPath = tempFile('config.toml');
    const existing = `
[general]
theme = "dark"

[mcp_servers."Legacy"]
command = "legacy"
args = ["--path", "/tmp"]
env = { LEGACY_TOKEN = "foo" }
`;
    await writeFile(configPath, existing, 'utf8');

    const plan = createPlan(configPath, [
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

    const adapter = createCodexAdapter();
    await adapter.sync(plan);

    const config = await parseConfig(configPath);
    expect(config.general.theme).toBe('dark');
    expect(config.mcp_servers.Legacy.command).toBe('legacy');
    expect(config.mcp_servers.Workspace).toMatchObject({
      command: 'relay-workspace',
      args: ['--flag'],
      env: { WORKSPACE_TOKEN: 'abc123' }
    });
    expect(config.relay.managed_servers).toEqual({ srv_workspace: 'Workspace' });

    const backup = await readFile(`${configPath}.bak`, 'utf8');
    expect(backup).toContain('[general]');
    expect(backup).toContain('Legacy');
  });

  it('removes Relay-managed servers when no longer present in the plan', async () => {
    const configPath = tempFile('config.toml');
    const existing = `
[mcp_servers."Legacy"]
command = "legacy"
args = []
env = {}

[mcp_servers."RelayOnly"]
command = "relay"
args = []
env = {}

[relay]
managed_servers = { srv_relay = "RelayOnly" }
`;
    await writeFile(configPath, existing, 'utf8');

    const plan = createPlan(configPath, []);

    const adapter = createCodexAdapter();
    await adapter.sync(plan);

    const config = await parseConfig(configPath);
    expect(config.mcp_servers).toEqual({
      Legacy: {
        command: 'legacy',
        args: [],
        env: {}
      }
    });
    expect(config.relay).toBeUndefined();
    await expect(stat(`${configPath}.bak`)).resolves.toBeDefined();
  });

  it('rejects invalid TOML files without overwriting them', async () => {
    const configPath = tempFile('config.toml');
    await writeFile(configPath, '[invalid\n', 'utf8');

    const plan = createPlan(configPath, [
      createServerPlan({
        server: createServerRecord({
          id: 'srv_error',
          name: 'Broken'
        }),
        env: {}
      })
    ]);

    const adapter = createCodexAdapter();
    await expect(adapter.sync(plan)).rejects.toThrow('invalid TOML');
  });
});
