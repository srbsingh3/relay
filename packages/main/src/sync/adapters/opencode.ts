import { createJsonMcpAdapter, defaultOpencodePath } from './json-config';

export const createOpencodeAdapter = () =>
  createJsonMcpAdapter({
    agent: 'opencode',
    defaultPath: defaultOpencodePath
  });
