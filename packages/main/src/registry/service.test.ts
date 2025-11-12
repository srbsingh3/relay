import { mkdtemp, mkdir, readFile, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const electronMock = vi.hoisted(() => {
  const state = { current: '' };
  const getPathMock = vi.fn(() => state.current);
  return { state, getPathMock };
});

vi.mock('electron', () => ({
  app: {
    getPath: electronMock.getPathMock
  }
}));

import { createEmptyRegistry, type RegistryServerRecord } from './schema';
import {
  clearRegistryCache,
  effectiveEnabled,
  generateServerId,
  getRegistryFilePath,
  loadRegistry,
  saveRegistry,
  RegistryLoadError
} from './service';

const createWorkspace = async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'relay-registry-'));
  electronMock.state.current = dir;
  clearRegistryCache();
  return dir;
};

const createServerRecord = (overrides: Partial<RegistryServerRecord> = {}): RegistryServerRecord => ({
  id: 'srv_test',
  name: 'Test Server',
  enabled: true,
  launch: {
    mode: 'command',
    command: '/usr/bin/env',
    args: []
  },
  env: {},
  ...overrides
});

describe('registry/service', () => {
  beforeEach(async () => {
    await createWorkspace();
  });

  it('initializes registry file when missing', async () => {
    const snapshot = await loadRegistry();
    expect(snapshot).toEqual(createEmptyRegistry());

    const registryPath = getRegistryFilePath();
    const fileContents = await readFile(registryPath, 'utf8');
    expect(JSON.parse(fileContents)).toEqual(snapshot);
    expect(fileContents.endsWith('\n')).toBe(true);
  });

  it('writes deterministic JSON with sorted env/app keys', async () => {
    const registry = await saveRegistry({
      version: 1,
      servers: [
        {
          id: 'srv_test',
          name: 'Test Server',
          enabled: false,
          launch: {
            mode: 'command',
            command: '/usr/local/bin/test-server',
            args: ['--beta', '--alpha']
          },
          env: {
            BETA: 'two',
            ALPHA: 'one'
          },
          apps: {
            cursor: false,
            codex: true
          }
        }
      ]
    });

    const server = registry.servers[0];
    expect(server?.env).toEqual({ ALPHA: 'one', BETA: 'two' });
    expect(server?.apps).toEqual({ cursor: false });
    expect(server?.launch.args).toEqual(['--beta', '--alpha']);

    const fileContents = await readFile(getRegistryFilePath(), 'utf8');
    expect(fileContents).toBe(JSON.stringify(registry, null, 2) + '\n');
  });

  it('throws on invalid registry JSON', async () => {
    const registryPath = getRegistryFilePath();
    await mkdir(path.dirname(registryPath), { recursive: true });
    await writeFile(registryPath, '{invalid json', 'utf8');

    await expect(loadRegistry()).rejects.toThrow(RegistryLoadError);
  });

  it('auto-generates deterministic server IDs with collision safety', async () => {
    const registry = await saveRegistry({
      version: 1,
      servers: [
        {
          ...createServerRecord({
            id: '',
            name: 'Context7 Primary'
          })
        },
        {
          ...createServerRecord({
            id: '',
            name: 'Context7 Primary'
          })
        },
        {
          ...createServerRecord({
            id: 'srv_context7_primary',
            name: 'Context7 Primary'
          })
        }
      ]
    });

    expect(registry.servers[0]?.id).toBe('srv_context7_primary');
    expect(registry.servers[1]?.id).toBe('srv_context7_primary_2');
    expect(registry.servers[2]?.id).toBe('srv_context7_primary_3');
  });

  it('persists only false app overrides', async () => {
    const registry = await saveRegistry({
      version: 1,
      servers: [
        {
          ...createServerRecord({
            id: 'srv_manual',
            apps: {
              cursor: false,
              claude: true,
              codex: true
            }
          })
        }
      ]
    });

    expect(registry.servers[0]?.apps).toEqual({ cursor: false });
  });

  it('computes effective enabled state for agents', () => {
    const base = createServerRecord({
      apps: {
        cursor: false
      }
    });

    expect(effectiveEnabled(base, 'cursor')).toBe(false);
    expect(effectiveEnabled(base, 'claude')).toBe(true);

    const disabled = { ...base, enabled: false };
    expect(effectiveEnabled(disabled, 'codex')).toBe(false);
  });

  it('generates server IDs for UI flows', () => {
    const existing: RegistryServerRecord[] = [
      createServerRecord({ id: 'srv_context7_primary' }),
      createServerRecord({ id: 'srv_context7_primary_2' })
    ];

    expect(generateServerId('Context7 Primary', existing)).toBe('srv_context7_primary_3');
    expect(generateServerId('  $$$New%% Server   ', existing)).toBe('srv_new_server');
  });
});
