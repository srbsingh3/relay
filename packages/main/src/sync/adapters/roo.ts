import { createJsonMcpAdapter, defaultRooPath } from './json-config';

export const createRooAdapter = () =>
  createJsonMcpAdapter({
    agent: 'roo',
    defaultPath: defaultRooPath
  });
