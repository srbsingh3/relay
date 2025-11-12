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

import { createEmptyRegistry } from './schema';
import { clearRegistryCache, getRegistryFilePath, loadRegistry, saveRegistry, RegistryLoadError } from './service';

const createWorkspace = async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'relay-registry-'));
  electronMock.state.current = dir;
  clearRegistryCache();
  return dir;
};

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
    expect(server?.apps).toEqual({ codex: true, cursor: false });
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
});
