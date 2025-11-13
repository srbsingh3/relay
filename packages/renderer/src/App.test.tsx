import { describe, expect, it } from 'vitest';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import type { DetectionSummary, RegistryServerEntry } from '../../main/src/ipc/contracts';
import type { SupportedAgent } from '../../main/src/types/agents';
import App, { deriveAppsForMasterToggle } from './App';

describe('App layout', () => {
  it('renders server rows with per-app toggles and master switch states', () => {
    const html = renderToStaticMarkup(<App />);
    expect(html).toContain('Workspace registry');
    expect(html).toContain('Settings');
    expect(html).toContain('Agent detection');
    expect(html).toContain('Manifest checks');
    expect(html).toContain('All apps');
    expect(html).toContain('aria-label="Per-app toggles"');
    expect(html).toContain('Not detected');
    expect(html).toContain('Custom');
  });

  it('reflects detection state for master and per-app toggles', () => {
    const html = renderToStaticMarkup(<App />);
    expect(html).toContain('All detected apps enabled');
    const codexButton = html.match(/<button[^>]+data-agent="codex"[^>]*>/);
    expect(codexButton).not.toBeNull();
    expect(codexButton?.[0]).toMatch(/\bdisabled\b/);
    expect(html).toContain('Not detected');
  });

  it('marks detection paths as read-only and surfaces the update opt-out toggle', () => {
    const html = renderToStaticMarkup(<App />);
    expect(html).toContain('data-readonly="config-path"');
    expect(html).toContain('Auto checks on');
  });

  it('renders the settings controls for sync status and manifest checks', () => {
    const html = renderToStaticMarkup(<App />);
    expect(html).toContain('Last sync');
    expect(html).toContain('Sync Now');
    expect(html).toContain('Manifest checks');
    expect(html).toContain('Latest manifest');
    expect(html).toContain('Check for updates');
  });
});

const buildDetection = (detected: Partial<Record<SupportedAgent, boolean>>): DetectionSummary => {
  const timestamp = '2024-01-01T00:00:00.000Z';
  return {
    cursor: { detected: Boolean(detected.cursor), path: null, lastChecked: timestamp },
    claude: { detected: Boolean(detected.claude), path: null, lastChecked: timestamp },
    codex: { detected: Boolean(detected.codex), path: null, lastChecked: timestamp }
  };
};

describe('deriveAppsForMasterToggle', () => {
  const baseServer: RegistryServerEntry = {
    id: 'srv_test',
    name: 'Test Server',
    enabled: true,
    launch: {
      mode: 'command',
      command: 'relay test',
      args: []
    },
    env: {}
  };

  it('forces every agent off when toggled to off', () => {
    const result = deriveAppsForMasterToggle(baseServer, buildDetection({ cursor: true }), 'off');
    expect(result).toEqual({
      cursor: false,
      claude: false,
      codex: false
    });
  });

  it('clears detected overrides when toggled on while preserving undetected entries', () => {
    const server: RegistryServerEntry = {
      ...baseServer,
      apps: {
        cursor: false,
        codex: false
      }
    };
    const detection = buildDetection({ cursor: true, claude: true, codex: false });
    const result = deriveAppsForMasterToggle(server, detection, 'on');
    expect(result).toEqual({
      codex: false
    });
  });

  it('returns undefined when every override is cleared while toggling on', () => {
    const server: RegistryServerEntry = {
      ...baseServer,
      apps: {
        cursor: false
      }
    };
    const detection = buildDetection({ cursor: true, claude: false, codex: false });
    const result = deriveAppsForMasterToggle(server, detection, 'on');
    expect(result).toBeUndefined();
  });
});
