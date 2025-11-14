import { createClaudeAdapter } from './claude';
import { createCodexAdapter } from './codex';
import { createCursorAdapter } from './cursor';
import type { SyncAdaptersMap } from '../types';

export const createDefaultAdapters = (): SyncAdaptersMap => ({
  cursor: createCursorAdapter(),
  claude: createClaudeAdapter(),
  codex: createCodexAdapter()
});
