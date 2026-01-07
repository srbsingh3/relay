import { createJsonMcpAdapter, defaultClinePath } from './json-config';

export const createClineAdapter = () =>
  createJsonMcpAdapter({
    agent: 'cline',
    defaultPath: defaultClinePath
  });
