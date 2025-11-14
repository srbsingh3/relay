import type { SyncAdapter } from '../types';

export const createCursorAdapter = (): SyncAdapter => ({
  agent: 'cursor',
  async sync() {}
});
