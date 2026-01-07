import { createAntigravityAdapter } from './antigravity';
import { createClaudeAdapter } from './claude';
import { createClineAdapter } from './cline';
import { createCodexAdapter } from './codex';
import { createCursorAdapter } from './cursor';
import { createKiloAdapter } from './kilo';
import { createOpencodeAdapter } from './opencode';
import { createRooAdapter } from './roo';
import type { SyncAdaptersMap } from '../types';

export const createDefaultAdapters = (): SyncAdaptersMap => ({
  cursor: createCursorAdapter(),
  claude: createClaudeAdapter(),
  codex: createCodexAdapter(),
  cline: createClineAdapter(),
  roo: createRooAdapter(),
  kilo: createKiloAdapter(),
  opencode: createOpencodeAdapter(),
  antigravity: createAntigravityAdapter(),
});
