import { createJsonMcpAdapter, defaultClaudePath } from './json-config';

export const createClaudeAdapter = () =>
  createJsonMcpAdapter({
    agent: 'claude',
    defaultPath: defaultClaudePath
  });
