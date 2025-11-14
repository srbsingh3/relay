import type { DetectionStatus } from '../ipc/contracts';
import type { RegistryEnvironmentMap, RegistryServerRecord } from '../registry/schema';
import type { SupportedAgent } from '../types/agents';

export interface AgentServerPlan {
  server: RegistryServerRecord;
  env: RegistryEnvironmentMap;
}

export interface AgentSyncPlan {
  agent: SupportedAgent;
  detection: DetectionStatus;
  servers: AgentServerPlan[];
}

export interface SyncAdapter {
  agent: SupportedAgent;
  sync(plan: AgentSyncPlan): Promise<void>;
}

export type SyncAdaptersMap = Record<SupportedAgent, SyncAdapter>;
