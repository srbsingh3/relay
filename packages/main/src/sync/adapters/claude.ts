import type { SyncAdapter } from '../types';

export const createClaudeAdapter = (): SyncAdapter => ({
  agent: 'claude',
  async sync() {}
});
