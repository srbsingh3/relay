import { createJsonMcpAdapter, defaultAntigravityPath } from './json-config';

export const createAntigravityAdapter = () =>
  createJsonMcpAdapter({
    agent: 'antigravity',
    defaultPath: defaultAntigravityPath
  });
