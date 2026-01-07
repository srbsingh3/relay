import { createJsonMcpAdapter, defaultKiloPath } from './json-config';

export const createKiloAdapter = () =>
  createJsonMcpAdapter({
    agent: 'kilo',
    defaultPath: defaultKiloPath
  });
