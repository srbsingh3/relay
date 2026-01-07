import { describe, expect, it, vi } from 'vitest';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import type { DetectionSummary } from '../../../main/src/ipc/contracts';
import type { SupportedAgent } from '../../../main/src/types/agents';
import ServerModal, { type EnvRow, serializeEnvRows } from './ServerModal';

const buildDetection = (detected: Partial<Record<SupportedAgent, boolean>>): DetectionSummary => {
  const timestamp = '2024-01-01T00:00:00.000Z';
  return {
    cursor: { detected: Boolean(detected.cursor), path: null, lastChecked: timestamp },
    claude: { detected: Boolean(detected.claude), path: null, lastChecked: timestamp },
    codex: { detected: Boolean(detected.codex), path: null, lastChecked: timestamp },
    cline: { detected: Boolean(detected.cline), path: null, lastChecked: timestamp },
    roo: { detected: Boolean(detected.roo), path: null, lastChecked: timestamp },
    kilo: { detected: Boolean(detected.kilo), path: null, lastChecked: timestamp },
    opencode: { detected: Boolean(detected.opencode), path: null, lastChecked: timestamp },
    antigravity: { detected: Boolean(detected.antigravity), path: null, lastChecked: timestamp },
  };
};

describe('ServerModal', () => {
  it('renders required fields for add flow', () => {
    const markup = renderToStaticMarkup(
      <ServerModal
        mode="add"
        detection={buildDetection({ cursor: true })}
        existingServers={[]}
        onCancel={vi.fn()}
        onSubmit={vi.fn()}
      />
    );

    expect(markup).toContain('Server name');
    expect(markup).toContain('Launch command');
    expect(markup).toContain('Keychain env aliases');
    expect(markup).toContain('Save');
  });

  it('serializes env rows into keychain-prefixed values and pending secrets', () => {
    const rows: EnvRow[] = [
      { id: '1', key: 'MCP_TOKEN', alias: 'workspace', secret: 's3cr3t' },
      { id: '2', key: '', alias: '', secret: '' },
      { id: '3', key: 'SECOND', alias: '', secret: '' }
    ];

    const result = serializeEnvRows(rows);
    expect(result.env).toEqual({ MCP_TOKEN: 'keychain:workspace' });
    expect(result.secrets).toEqual([{ alias: 'workspace', secret: 's3cr3t' }]);
  });

  it('deduplicates secrets for aliases reused across env rows', () => {
    const rows: EnvRow[] = [
      { id: '1', key: 'PRIMARY', alias: 'shared', secret: 'alpha' },
      { id: '2', key: 'SECONDARY', alias: 'shared', secret: 'beta' }
    ];

    const result = serializeEnvRows(rows);
    expect(result.env).toEqual({
      PRIMARY: 'keychain:shared',
      SECONDARY: 'keychain:shared'
    });
    expect(result.secrets).toEqual([{ alias: 'shared', secret: 'beta' }]);
  });
});
