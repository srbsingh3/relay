import { app } from 'electron';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

import { atomicWrite, ensureDir } from '../fs/io';
import { collectAliasReferences, getKeychainService } from '../keychain/service';
import { SUPPORTED_AGENTS, type SupportedAgent } from '../types/agents';
import {
  REGISTRY_VERSION,
  createEmptyRegistry,
  type RegistryAppOverrides,
  type RegistryEnvironmentMap,
  type RegistryFile,
  type RegistryLaunchConfig,
  type RegistryServerRecord
} from './schema';

const REGISTRY_DIRECTORY_NAME = 'Relay';
const REGISTRY_FILE_NAME = 'registry.json';
const JSON_INDENT = 2;
const SERVER_ID_PREFIX = 'srv_';
const DEFAULT_SERVER_SLUG = 'server';

let cachedRegistry: RegistryFile | null = null;
let hasEnsuredDirectory = false;

const slugifyServerName = (input: string): string => {
  const slug = input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/_{2,}/g, '_')
    .replace(/^_+|_+$/g, '');
  return slug.length > 0 ? slug : DEFAULT_SERVER_SLUG;
};

const reserveUniqueId = (seed: string, usedIds: Set<string>): string => {
  let candidate = seed;
  let counter = 2;

  while (usedIds.has(candidate)) {
    candidate = `${seed}_${counter}`;
    counter += 1;
  }

  usedIds.add(candidate);
  return candidate;
};

const createGeneratedServerId = (name: string, usedIds: Set<string>): string => {
  const slug = slugifyServerName(name);
  return reserveUniqueId(`${SERVER_ID_PREFIX}${slug}`, usedIds);
};

export class RegistryError extends Error {}

export class RegistryLoadError extends RegistryError {
  constructor(message: string, public readonly cause?: unknown) {
    super(message);
  }
}

export class RegistryValidationError extends RegistryError {
  constructor(message: string) {
    super(message);
  }
}

export const getRegistryDirectory = () => path.join(app.getPath('appData'), REGISTRY_DIRECTORY_NAME);

export const getRegistryFilePath = () => path.join(getRegistryDirectory(), REGISTRY_FILE_NAME);

const ensureRegistryDirectory = async () => {
  if (hasEnsuredDirectory) {
    return;
  }

  await ensureDir(getRegistryDirectory());
  hasEnsuredDirectory = true;
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const normalizeString = (value: unknown): string => (typeof value === 'string' ? value.trim() : '');

const nonEmptyString = (value: unknown): string | null => {
  const normalized = normalizeString(value);
  return normalized.length > 0 ? normalized : null;
};

const sanitizeLaunchConfig = (value: unknown): RegistryLaunchConfig | null => {
  if (!isRecord(value)) {
    return null;
  }

  const command = nonEmptyString(value.command);
  if (!command) {
    return null;
  }

  const rawArgs = Array.isArray(value.args) ? value.args : [];
  const args = rawArgs.map((arg) => nonEmptyString(arg)).filter((arg): arg is string => Boolean(arg));

  return {
    mode: 'command',
    command,
    args
  };
};

const sanitizeEnvironment = (value: unknown): RegistryEnvironmentMap => {
  if (!isRecord(value)) {
    return {};
  }

  const envEntries = Object.entries(value)
    .map(([key, rawValue]) => {
      const normalizedKey = normalizeString(key);
      const normalizedValue = nonEmptyString(rawValue);
      if (!normalizedKey || normalizedValue === null) {
        return null;
      }

      return [normalizedKey, normalizedValue] as const;
    })
    .filter((entry): entry is readonly [string, string] => Boolean(entry));

  return envEntries.reduce<RegistryEnvironmentMap>((acc, [key, val]) => {
    acc[key] = val;
    return acc;
  }, {});
};

const isSupportedAgentKey = (key: string): key is SupportedAgent =>
  SUPPORTED_AGENTS.includes(key as SupportedAgent);

const isFalseAgentEntry = (entry: [string, unknown]): entry is [SupportedAgent, false] =>
  entry[1] === false && isSupportedAgentKey(entry[0]);

const sanitizeApps = (value: unknown): RegistryAppOverrides | undefined => {
  if (!isRecord(value)) {
    return undefined;
  }

  const entries = Object.entries(value).filter(isFalseAgentEntry);
  if (entries.length === 0) {
    return undefined;
  }

  return entries.reduce<RegistryAppOverrides>((acc, [key]) => {
    acc[key] = false;
    return acc;
  }, {});
};

const sanitizeServerRecord = (value: unknown, usedIds: Set<string>): RegistryServerRecord | null => {
  if (!isRecord(value)) {
    return null;
  }

  const name = nonEmptyString(value.name);
  const launch = sanitizeLaunchConfig(value.launch);

  if (!name || !launch) {
    return null;
  }

  const providedId = nonEmptyString(value.id);
  const id = providedId ? reserveUniqueId(providedId, usedIds) : createGeneratedServerId(name, usedIds);
  const enabled = typeof value.enabled === 'boolean' ? value.enabled : true;
  const env = sanitizeEnvironment(value.env);
  const apps = sanitizeApps(value.apps);

  const server: RegistryServerRecord = {
    id,
    name,
    enabled,
    launch,
    env
  };

  if (apps && Object.keys(apps).length > 0) {
    server.apps = apps;
  }

  return server;
};

const sanitizeRegistryFile = (value: unknown): RegistryFile => {
  if (!isRecord(value)) {
    return createEmptyRegistry();
  }

  const parsedVersion = Number((value as Record<string, unknown>).version);
  const version = Number.isFinite(parsedVersion) ? parsedVersion : REGISTRY_VERSION;
  const usedIds = new Set<string>();
  const servers = Array.isArray(value.servers)
    ? value.servers
        .map((server) => sanitizeServerRecord(server, usedIds))
        .filter((server): server is RegistryServerRecord => Boolean(server))
    : [];

  return {
    version,
    servers
  };
};

const migrateRegistry = (registry: RegistryFile): RegistryFile => {
  if (registry.version === REGISTRY_VERSION) {
    return registry;
  }

  return {
    ...registry,
    version: REGISTRY_VERSION
  };
};

const sortObjectKeys = <T>(input: Record<string, T>): Record<string, T> => {
  return Object.keys(input)
    .sort((a, b) => a.localeCompare(b))
    .reduce<Record<string, T>>((acc, key) => {
      acc[key] = input[key];
      return acc;
    }, {});
};

const normalizeApps = (apps?: RegistryAppOverrides): RegistryAppOverrides | undefined => {
  if (!apps) {
    return undefined;
  }

  const sortedEntries = Object.entries(apps).filter(isFalseAgentEntry);
  if (sortedEntries.length === 0) {
    return undefined;
  }

  sortedEntries.sort(([a], [b]) => a.localeCompare(b));

  return sortedEntries.reduce<RegistryAppOverrides>((acc, [key, value]) => {
    acc[key] = value;
    return acc;
  }, {});
};

const normalizeServer = (server: RegistryServerRecord): RegistryServerRecord => {
  const normalized: RegistryServerRecord = {
    id: server.id,
    name: server.name,
    enabled: Boolean(server.enabled),
    launch: {
      mode: 'command',
      command: server.launch.command,
      args: [...server.launch.args]
    },
    env: sortObjectKeys(server.env)
  };

  const normalizedApps = normalizeApps(server.apps);
  if (normalizedApps) {
    normalized.apps = normalizedApps;
  }

  return normalized;
};

const normalizeRegistry = (registry: RegistryFile): RegistryFile => ({
  version: registry.version ?? REGISTRY_VERSION,
  servers: registry.servers.map(normalizeServer)
});

const serializeRegistry = (registry: RegistryFile) => `${JSON.stringify(registry, null, JSON_INDENT)}\n`;

const persistRegistry = async (registry: RegistryFile) => {
  await ensureRegistryDirectory();
  await atomicWrite(getRegistryFilePath(), serializeRegistry(registry));
};

const findRemovedAliases = (previous: RegistryFile | null, next: RegistryFile): string[] => {
  if (!previous) {
    return [];
  }

  const previousAliases = collectAliasReferences(previous);
  const nextAliases = collectAliasReferences(next);

  return Array.from(previousAliases.entries())
    .filter(([alias, count]) => count > 0 && (nextAliases.get(alias) ?? 0) === 0)
    .map(([alias]) => alias);
};

const deleteUnusedAliases = async (
  aliases: string[],
  keychainService: ReturnType<typeof getKeychainService>
) => {
  if (aliases.length === 0) {
    return;
  }

  await Promise.all(
    aliases.map(async (alias) => {
      try {
        await keychainService.deleteSecret(alias);
      } catch (error) {
        console.error(`[relay] Failed to delete unused Keychain alias "${alias}"`, error);
      }
    })
  );
};

export const loadRegistry = async (): Promise<RegistryFile> => {
  if (cachedRegistry) {
    return cachedRegistry;
  }

  try {
    await ensureRegistryDirectory();
  } catch (error) {
    throw new RegistryLoadError('Failed to prepare registry directory', error);
  }

  const filePath = getRegistryFilePath();
  let rawContents: string | null = null;

  try {
    rawContents = await readFile(filePath, 'utf8');
  } catch (error: unknown) {
    if ((error as NodeJS.ErrnoException)?.code !== 'ENOENT') {
      throw new RegistryLoadError('Unable to read registry file', error);
    }
  }

  if (rawContents === null) {
    const fresh = createEmptyRegistry();
    await persistRegistry(fresh);
    cachedRegistry = fresh;
    getKeychainService().syncAliasReferences(fresh);
    return fresh;
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(rawContents);
  } catch (error) {
    throw new RegistryLoadError('Registry file contains invalid JSON', error);
  }

  const sanitized = sanitizeRegistryFile(parsed);
  const migrated = migrateRegistry(sanitized);
  const normalized = normalizeRegistry(migrated);

  cachedRegistry = normalized;
  getKeychainService().syncAliasReferences(normalized);
  return normalized;
};

export const saveRegistry = async (registry: RegistryFile): Promise<RegistryFile> => {
  const previousRegistry = cachedRegistry;
  const sanitized = sanitizeRegistryFile(registry);
  const migrated = migrateRegistry(sanitized);
  const normalized = normalizeRegistry(migrated);

  await persistRegistry(normalized);
  cachedRegistry = normalized;
  const keychainService = getKeychainService();
  keychainService.syncAliasReferences(normalized);
  const removedAliases = findRemovedAliases(previousRegistry, normalized);
  await deleteUnusedAliases(removedAliases, keychainService);
  return normalized;
};

export const effectiveEnabled = (server: RegistryServerRecord, agent: SupportedAgent): boolean => {
  return Boolean(server.enabled) && (server.apps?.[agent] ?? true);
};

export const generateServerId = (name: string, existingServers: RegistryServerRecord[] = []): string => {
  const usedIds = new Set(existingServers.map((server) => server.id));
  return createGeneratedServerId(name, usedIds);
};

export const clearRegistryCache = () => {
  cachedRegistry = null;
  hasEnsuredDirectory = false;
};
