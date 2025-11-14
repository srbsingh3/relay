import type { SyncAdapter } from '../types';

export const createCodexAdapter = (): SyncAdapter => ({
  agent: 'codex',
  async sync() {}
});
