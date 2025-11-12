import type { SupportedAgent } from '../types/agents';

export const REGISTRY_VERSION = 1;

export type RegistryLaunchMode = 'command';

export interface RegistryLaunchCommand {
  mode: RegistryLaunchMode;
  command: string;
  args: string[];
}

export type RegistryLaunchConfig = RegistryLaunchCommand;

export type RegistryEnvironmentMap = Record<string, string>;

export type RegistryAppOverrides = Partial<Record<SupportedAgent, boolean>>;

export interface RegistryServerRecord {
  id: string;
  name: string;
  enabled: boolean;
  launch: RegistryLaunchConfig;
  env: RegistryEnvironmentMap;
  apps?: RegistryAppOverrides;
}

export interface RegistryFile {
  version: number;
  servers: RegistryServerRecord[];
}

export const createEmptyRegistry = (): RegistryFile => ({
  version: REGISTRY_VERSION,
  servers: []
});
