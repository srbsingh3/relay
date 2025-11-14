import { createJsonMcpAdapter, defaultCursorPath } from './json-config';

export const createCursorAdapter = () =>
  createJsonMcpAdapter({
    agent: 'cursor',
    defaultPath: defaultCursorPath
  });
