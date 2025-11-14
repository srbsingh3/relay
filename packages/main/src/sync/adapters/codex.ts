import { parse as parseToml, stringify as stringifyToml } from '@iarna/toml';
import { readFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { atomicWrite } from '../../fs/io';
import type { AgentServerPlan, AgentSyncPlan, SyncAdapter } from '../types';
import { SyncAdapterError, isFsPermissionError } from '../errors';

type CodexServerEntry = Record<string, unknown>;
type CodexServersMap = Record<string, CodexServerEntry>;
type RelayManagedMap = Record<string, string>;

interface RelaySection {
  managed_servers?: RelayManagedMap;
  [key: string]: unknown;
}

interface CodexConfig {
  mcp_servers?: CodexServersMap;
  relay?: RelaySection;
  [key: string]: unknown;
}

const defaultCodexPath = () => path.join(os.homedir(), '.codex', 'config.toml');

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const isRelaySection = (value: unknown): value is RelaySection => isRecord(value);

const isTomlError = (error: unknown): boolean => {
  if (!(error instanceof Error)) {
    return false;
  }

  return error.name === 'TomlError' || error instanceof SyntaxError;
};

const loadCodexConfig = async (filePath: string): Promise<CodexConfig> => {
  try {
    const contents = await readFile(filePath, 'utf8');
    return normalizeConfig(parseToml(contents));
  } catch (error) {
    if ((error as NodeJS.ErrnoException)?.code === 'ENOENT') {
      return {};
    }

    if (isTomlError(error)) {
      throw new SyncAdapterError({
        agent: 'codex',
        code: 'ERR_INVALID_CONFIG',
        message: 'Codex config contains invalid TOML.',
        filePath,
        cause: error
      });
    }

    if (isFsPermissionError(error)) {
      throw new SyncAdapterError({
        agent: 'codex',
        code: 'ERR_PERMISSION_DENIED',
        message: 'Codex config cannot be accessed (permission denied).',
        filePath,
        cause: error
      });
    }

    throw new SyncAdapterError({
      agent: 'codex',
      code: 'ERR_IO_FAILURE',
      message: 'Unable to read Codex config.',
      filePath,
      cause: error
    });
  }
};

const normalizeConfig = (input: unknown): CodexConfig => {
  const base = isRecord(input) ? { ...input } : {};
  const servers = isRecord(base.mcp_servers) ? { ...base.mcp_servers } : {};
  const relay = isRelaySection(base.relay) ? { ...base.relay } : undefined;

  const managed = normalizeManaged(relay?.managed_servers);
  if (relay) {
    const { managed_servers: _ignored, ...rest } = relay;
    const normalizedRelay: RelaySection = { ...rest };
    if (managed) {
      normalizedRelay.managed_servers = managed;
    }
    return {
      ...base,
      mcp_servers: servers,
      relay: isRelaySection(normalizedRelay) && Object.keys(normalizedRelay).length > 0 ? normalizedRelay : undefined
    };
  }

  return {
    ...base,
    mcp_servers: servers
  };
};

const normalizeManaged = (value: unknown): RelayManagedMap | undefined => {
  if (!isRecord(value)) {
    return undefined;
  }

  const entries = Object.entries(value).reduce<RelayManagedMap>((acc, [key, raw]) => {
    if (typeof raw === 'string') {
      acc[key] = raw;
    }
    return acc;
  }, {});

  return Object.keys(entries).length > 0 ? entries : undefined;
};

const sortObject = <T>(input: Record<string, T>): Record<string, T> => {
  const sortedKeys = Object.keys(input).sort((a, b) => a.localeCompare(b));
  return sortedKeys.reduce<Record<string, T>>((acc, key) => {
    acc[key] = input[key];
    return acc;
  }, {});
};

const normalizeEnv = (plan: AgentServerPlan): Record<string, string> => {
  const envEntries = Object.entries(plan.env ?? {});
  if (envEntries.length === 0) {
    return {};
  }

  return envEntries
    .sort(([a], [b]) => a.localeCompare(b))
    .reduce<Record<string, string>>((acc, [key, value]) => {
      acc[key] = value;
      return acc;
    }, {});
};

const buildServerEntry = (plan: AgentServerPlan): CodexServerEntry => ({
  command: plan.server.launch.command,
  args: [...plan.server.launch.args],
  env: normalizeEnv(plan)
});

const applyPlanToConfig = (plan: AgentSyncPlan, config: CodexConfig) => {
  const nextServers: CodexServersMap = { ...(config.mcp_servers ?? {}) };
  const previousManaged: RelayManagedMap = { ...(config.relay?.managed_servers ?? {}) };
  const nextManaged: RelayManagedMap = {};

  const removeByName = (name?: string) => {
    if (typeof name === 'string') {
      delete nextServers[name];
    }
  };

  for (const entry of plan.servers) {
    const serverId = entry.server.id;
    const serverName = entry.server.name;
    const previousName = previousManaged[serverId];

    if (previousName && previousName !== serverName) {
      removeByName(previousName);
    }

    nextServers[serverName] = buildServerEntry(entry);
    nextManaged[serverId] = serverName;
  }

  Object.entries(previousManaged).forEach(([serverId, serverName]) => {
    if (!nextManaged[serverId]) {
      removeByName(serverName);
    }
  });

  return {
    servers: sortObject(nextServers),
    managed: nextManaged
  };
};

const serializeConfig = (config: CodexConfig): string => {
  const output = stringifyToml(config);
  return output.endsWith('\n') ? output : `${output}\n`;
};

const nextConfigFromPlan = (plan: AgentSyncPlan, existing: CodexConfig): CodexConfig => {
  const { servers, managed } = applyPlanToConfig(plan, existing);
  const { mcp_servers: _ignored, relay: existingRelay, ...rest } = existing;
  const relayRest = isRelaySection(existingRelay) ? { ...existingRelay } : undefined;
  if (relayRest) {
    delete (relayRest as RelaySection).managed_servers;
  }

  const nextConfig: CodexConfig = {
    ...rest,
    mcp_servers: servers
  };

  const hasManaged = Object.keys(managed).length > 0;
  if (relayRest || hasManaged) {
    const relaySection: RelaySection = {
      ...(relayRest ?? {})
    };

    if (hasManaged) {
      relaySection.managed_servers = sortObject(managed);
    }

    if (Object.keys(relaySection).length > 0) {
      nextConfig.relay = relaySection;
    }
  }

  return nextConfig;
};

const resolveConfigPath = (plan: AgentSyncPlan) => plan.detection.path ?? defaultCodexPath();

export const createCodexAdapter = (): SyncAdapter => ({
  agent: 'codex',
  async sync(plan) {
    const configPath = resolveConfigPath(plan);
    const existing = await loadCodexConfig(configPath);
    const nextConfig = nextConfigFromPlan(plan, existing);
    try {
      await atomicWrite(configPath, serializeConfig(nextConfig));
    } catch (error) {
      if (error instanceof SyncAdapterError) {
        throw error;
      }

      if (isFsPermissionError(error)) {
        throw new SyncAdapterError({
          agent: plan.agent,
          code: 'ERR_PERMISSION_DENIED',
          message: 'Codex config cannot be written (permission denied).',
          filePath: configPath,
          cause: error
        });
      }

      throw new SyncAdapterError({
        agent: plan.agent,
        code: 'ERR_IO_FAILURE',
        message: 'Unable to write Codex config.',
        filePath: configPath,
        cause: error
      });
    }
  }
});
