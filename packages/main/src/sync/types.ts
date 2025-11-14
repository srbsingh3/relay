import type { DetectionStatus } from '../ipc/contracts';
import type { RegistryServerRecord } from '../registry/schema';
import type { SupportedAgent } from '../types/agents';

export interface AgentSyncPlan {
  agent: SupportedAgent;
  detection: DetectionStatus;
  servers: RegistryServerRecord[];
}

export interface SyncAdapter {
  agent: SupportedAgent;
  sync(plan: AgentSyncPlan): Promise<void>;
}

export type SyncAdaptersMap = Record<SupportedAgent, SyncAdapter>;
