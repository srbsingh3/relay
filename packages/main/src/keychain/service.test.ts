import { describe, expect, it, vi } from 'vitest';

import { type RegistryFile, type RegistryServerRecord } from '../registry/schema';
import {
  KeychainService,
  type KeytarBinding,
  KEYCHAIN_SERVICE_NAME,
  collectAliasReferences,
  extractAliasFromValue
} from './service';

const createServer = (id: string, env: Record<string, string> = {}): RegistryServerRecord => ({
  id,
  name: `Server ${id}`,
  enabled: true,
  launch: {
    mode: 'command',
    command: '/usr/bin/env',
    args: []
  },
  env
});

const createRegistry = (servers: RegistryServerRecord[]): RegistryFile => ({
  version: 1,
  servers
});

const createBinding = () => {
  const storage = new Map<string, string>();

  const binding: KeytarBinding = {
    setPassword: vi.fn(async (service, account, password) => {
      expect(service).toBe(KEYCHAIN_SERVICE_NAME);
      storage.set(account, password);
    }),
    getPassword: vi.fn(async (service, account) => {
      expect(service).toBe(KEYCHAIN_SERVICE_NAME);
      return storage.get(account) ?? null;
    }),
    deletePassword: vi.fn(async (service, account) => {
      expect(service).toBe(KEYCHAIN_SERVICE_NAME);
      const existed = storage.delete(account);
      return existed;
    })
  };

  return { binding, storage };
};

describe('keychain/service', () => {
  it('writes and reads secrets via the keytar binding', async () => {
    const { binding } = createBinding();
    const service = new KeychainService(binding);

    await service.setSecret('context7_primary', 'initial-secret');
    await service.setSecret('context7_primary', 'updated-secret');

    expect(binding.setPassword).toHaveBeenCalledTimes(2);
    await expect(service.getSecret('context7_primary')).resolves.toBe('updated-secret');
  });

  it('prevents deletion when aliases are still referenced', async () => {
    const { binding } = createBinding();
    const service = new KeychainService(binding);

    const registry = createRegistry([
      createServer('srv_one', {
        CONTEXT7_TOKEN: 'keychain:shared_token'
      }),
      createServer('srv_two', {
        OTHER_TOKEN: 'keychain:shared_token'
      })
    ]);

    service.syncAliasReferences(registry);
    const deleted = await service.deleteSecret('shared_token');
    expect(deleted).toBe(false);
    expect(binding.deletePassword).not.toHaveBeenCalled();
  });

  it('allows deletion once no registry references remain', async () => {
    const { binding } = createBinding();
    const service = new KeychainService(binding);

    service.syncAliasReferences(
      createRegistry([
        createServer('srv_one', {
          TOKEN: 'keychain:shared_token'
        })
      ])
    );

    await service.setSecret('shared_token', 'top-secret');

    const blocked = await service.deleteSecret('shared_token');
    expect(blocked).toBe(false);

    service.syncAliasReferences(createRegistry([]));

    const deleted = await service.deleteSecret('shared_token');
    expect(deleted).toBe(true);
    expect(binding.deletePassword).toHaveBeenCalledWith('com.relay.app', 'token:shared_token');
  });

  it('collects alias references across servers and env keys', () => {
    const registry = createRegistry([
      createServer('srv_one', {
        FIRST: 'keychain:alpha',
        SECOND: 'keychain:alpha',
        THIRD: 'keychain:beta'
      }),
      createServer('srv_two', {
        FOURTH: 'not-a-keychain-value',
        FIFTH: 'keychain:gamma'
      })
    ]);

    const counts = collectAliasReferences(registry);
    expect(counts.get('alpha')).toBe(2);
    expect(counts.get('beta')).toBe(1);
    expect(counts.get('gamma')).toBe(1);
    expect(counts.get('missing')).toBeUndefined();
  });

  it('extracts aliases from env values only when prefixed correctly', () => {
    expect(extractAliasFromValue('keychain:alpha')).toBe('alpha');
    expect(extractAliasFromValue('keychain:  beta ')).toBe('beta');
    expect(extractAliasFromValue(' Keychain:gamma')).toBe('gamma');
    expect(extractAliasFromValue('alias')).toBeNull();
    expect(extractAliasFromValue(null)).toBeNull();
  });
});
