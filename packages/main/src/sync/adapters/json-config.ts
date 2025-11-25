import { readFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { atomicWrite } from '../../fs/io';
import type { SupportedAgent } from '../../types/agents';
import type { AgentServerPlan, AgentSyncPlan, SyncAdapter } from '../types';
import { SyncAdapterError, isFsPermissionError } from '../errors';

const JSON_INDENT = 2;
const RELAY_META_KEY = '__relayManagedServers';

type JsonMcpServers = Record<string, Record<string, unknown>>;
type RelayManagedMap = Record<string, string>;

interface JsonConfig {
  mcpServers: JsonMcpServers;
  [key: string]: unknown;
  [RELAY_META_KEY]?: RelayManagedMap;
}

interface JsonAdapterOptions {
  agent: SupportedAgent;
  defaultPath: () => string;
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const isEnoent = (error: unknown): boolean => (error as NodeJS.ErrnoException)?.code === 'ENOENT';

const AGENT_LABELS: Record<SupportedAgent, string> = {
  cursor: 'Cursor',
  claude: 'Claude',
  codex: 'Codex'
};

const agentLabel = (agent: SupportedAgent) => AGENT_LABELS[agent] ?? 'Agent';

const loadJsonConfig = async (agent: SupportedAgent, filePath: string): Promise<JsonConfig> => {
  try {
    const contents = await readFile(filePath, 'utf8');
    return normalizeConfig(JSON.parse(contents));
  } catch (error) {
    if (isEnoent(error)) {
      return { mcpServers: {} };
    }

    if (error instanceof SyntaxError) {
      throw new SyncAdapterError({
        agent,
        code: 'ERR_INVALID_CONFIG',
        message: `${agentLabel(agent)} config contains invalid JSON.`,
        filePath,
        cause: error
      });
    }

    if (isFsPermissionError(error)) {
      throw new SyncAdapterError({
        agent,
        code: 'ERR_PERMISSION_DENIED',
        message: `${agentLabel(agent)} config cannot be accessed (permission denied).`,
        filePath,
        cause: error
      });
    }

    throw new SyncAdapterError({
      agent,
      code: 'ERR_IO_FAILURE',
      message: `Unable to read ${agentLabel(agent)} config.`,
      filePath,
      cause: error
    });
  }
};

const normalizeServers = (input: unknown): JsonMcpServers => {
  if (!isRecord(input)) {
    return {};
  }

  const output: JsonMcpServers = {};
  Object.entries(input).forEach(([key, value]) => {
    if (isRecord(value)) {
      output[key] = value;
    }
  });
  return output;
};

const normalizeConfig = (input: unknown): JsonConfig => {
  const base = isRecord(input) ? { ...input } : {};
  const normalized: JsonConfig = {
    ...base,
    mcpServers: normalizeServers(base.mcpServers)
  };

  const managed = normalizeManagedMap(base[RELAY_META_KEY]);
  if (managed) {
    normalized[RELAY_META_KEY] = managed;
  } else {
    delete normalized[RELAY_META_KEY];
  }

  return normalized;
};

const normalizeManagedMap = (value: unknown): RelayManagedMap | undefined => {
  if (!isRecord(value)) {
    return undefined;
  }

  const entries = Object.entries(value).reduce<RelayManagedMap>((acc, [key, entryValue]) => {
    if (typeof entryValue === 'string') {
      acc[key] = entryValue;
    }

    return acc;
  }, {});

  if (Object.keys(entries).length === 0) {
    return undefined;
  }

  return entries;
};

const serializeConfig = (config: JsonConfig): string => `${JSON.stringify(config, null, JSON_INDENT)}\n`;

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

const buildServerPayload = (plan: AgentServerPlan) => ({
  command: plan.server.launch.command,
  args: [...plan.server.launch.args],
  env: normalizeEnv(plan)
});

const applyPlanToConfig = (plan: AgentSyncPlan, config: JsonConfig) => {
  const nextServers: JsonMcpServers = { ...config.mcpServers };
  const previousManaged: RelayManagedMap = { ...(config[RELAY_META_KEY] ?? {}) };
  const nextManaged: RelayManagedMap = {};

  const removeServerByName = (name?: string) => {
    if (typeof name === 'string') {
      delete nextServers[name];
    }
  };

  for (const entry of plan.servers) {
    const serverId = entry.server.id;
    const serverName = entry.server.name;
    const previousName = previousManaged[serverId];

    if (previousName && previousName !== serverName) {
      removeServerByName(previousName);
    }

    nextServers[serverName] = buildServerPayload(entry);
    nextManaged[serverId] = serverName;
  }

  Object.entries(previousManaged).forEach(([serverId, serverName]) => {
    if (!nextManaged[serverId]) {
      removeServerByName(serverName);
    }
  });

  return {
    servers: sortObject(nextServers),
    managed: nextManaged
  };
};

const nextConfigFromPlan = (plan: AgentSyncPlan, existing: JsonConfig): JsonConfig => {
  const { servers, managed } = applyPlanToConfig(plan, existing);
  const { mcpServers: _ignored, [RELAY_META_KEY]: _managed, ...rest } = existing;
  const base: Record<string, unknown> = { ...rest };

  const nextConfig: JsonConfig = {
    ...base,
    mcpServers: servers
  };

  if (Object.keys(managed).length > 0) {
    nextConfig[RELAY_META_KEY] = sortObject(managed);
  }

  return nextConfig;
};

const resolveConfigPath = (plan: AgentSyncPlan, defaultPath: () => string) =>
  plan.detection.path ?? defaultPath();

export const createJsonMcpAdapter = (options: JsonAdapterOptions): SyncAdapter => ({
  agent: options.agent,
  async sync(plan) {
    const configPath = resolveConfigPath(plan, options.defaultPath);
    const existing = await loadJsonConfig(plan.agent, configPath);
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
          message: `${agentLabel(plan.agent)} config cannot be written (permission denied).`,
          filePath: configPath,
          cause: error
        });
      }

      throw new SyncAdapterError({
        agent: plan.agent,
        code: 'ERR_IO_FAILURE',
        message: `Unable to write ${agentLabel(plan.agent)} config.`,
        filePath: configPath,
        cause: error
      });
    }
  }
});

export const defaultCursorPath = () => path.join(os.homedir(), '.cursor', 'mcp.json');
export const defaultClaudePath = () => path.join(os.homedir(), '.claude.json');
