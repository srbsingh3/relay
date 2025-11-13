import { useCallback, useEffect, useMemo, useState } from 'react';
import './styles.css';
import type {
  DetectionStatus,
  DetectionSummary,
  RegistryServerEntry,
  RegistrySnapshot
} from '../../main/src/ipc/contracts';
import { REGISTRY_VERSION } from '../../main/src/registry/schema';
import type { SupportedAgent } from '../../main/src/types/agents';
import { SUPPORTED_AGENTS } from '../../main/src/types/agents';
import ServerModal, { type ServerFormSubmitPayload } from './components/ServerModal';

const agentLabels: Record<SupportedAgent, string> = {
  cursor: 'Cursor',
  claude: 'Claude',
  codex: 'Codex'
};

const buildDetectionSnapshot = (
  overrides?: Partial<Record<SupportedAgent, Partial<DetectionStatus>>>
): DetectionSummary => {
  const timestamp = new Date().toISOString();
  return SUPPORTED_AGENTS.reduce<DetectionSummary>((acc, agent) => {
    const override = overrides?.[agent];
    acc[agent] = {
      detected: override?.detected ?? false,
      path: override?.path ?? null,
      lastChecked: override?.lastChecked ?? timestamp
    };
    return acc;
  }, {} as DetectionSummary);
};

const fallbackServers: RegistryServerEntry[] = [
  {
    id: 'srv_workspace',
    name: 'Workspace Relay',
    enabled: true,
    launch: {
      mode: 'command',
      command: 'uvx relay serve workspace',
      args: ['--watch']
    },
    env: {},
    apps: {
      codex: false
    }
  },
  {
    id: 'srv_research',
    name: 'Research Drafts',
    enabled: true,
    launch: {
      mode: 'command',
      command: 'bun relay sync research',
      args: ['--json']
    },
    env: {
      RELAY_ENV: 'research'
    },
    apps: {
      claude: false
    }
  }
];

const fallbackDetection = buildDetectionSnapshot({
  cursor: { detected: true, path: '/Applications/Cursor.app' },
  claude: { detected: true, path: '/Applications/Claude.app' },
  codex: { detected: false }
});

const fallbackRegistrySnapshot: RegistrySnapshot = {
  version: REGISTRY_VERSION,
  servers: fallbackServers
};

const SERVER_ID_PREFIX = 'srv_';
const DEFAULT_SERVER_SLUG = 'server';

const slugifyServerName = (input: string): string =>
  input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/_{2,}/g, '_')
    .replace(/^_+|_+$/g, '');

const reserveUniqueId = (seed: string, used: Set<string>): string => {
  let candidate = seed;
  let counter = 2;
  while (used.has(candidate)) {
    candidate = `${seed}_${counter}`;
    counter += 1;
  }
  used.add(candidate);
  return candidate;
};

const generateServerId = (name: string, existing: RegistryServerEntry[]): string => {
  const used = new Set(existing.map((server) => server.id));
  const slug = slugifyServerName(name) || DEFAULT_SERVER_SLUG;
  return reserveUniqueId(`${SERVER_ID_PREFIX}${slug}`, used);
};

type MasterState = 'on' | 'off' | 'custom';
type MasterIntent = Extract<MasterState, 'on' | 'off'>;
type ModalState = { mode: 'add' } | { mode: 'edit'; serverId: string } | null;

const masterLabels: Record<MasterState, string> = {
  on: 'All detected apps enabled',
  off: 'Disabled for every app',
  custom: 'Mix of enabled/disabled apps'
};

const normalizeAppOverrides = (overrides?: RegistryServerEntry['apps']): RegistryServerEntry['apps'] | undefined => {
  if (!overrides) {
    return undefined;
  }

  const entries = Object.entries(overrides).filter(([, value]) => value === false);
  if (entries.length === 0) {
    return undefined;
  }

  return entries.reduce<RegistryServerEntry['apps']>((acc, [key]) => {
    acc[key as SupportedAgent] = false;
    return acc;
  }, {} as RegistryServerEntry['apps']);
};

export const deriveAppsForMasterToggle = (
  server: RegistryServerEntry,
  detection: DetectionSummary,
  target: MasterIntent
): RegistryServerEntry['apps'] | undefined => {
  if (target === 'off') {
    return SUPPORTED_AGENTS.reduce<RegistryServerEntry['apps']>((acc, agent) => {
      acc[agent] = false;
      return acc;
    }, {} as RegistryServerEntry['apps']);
  }

  const overrides = { ...(server.apps ?? {}) };
  SUPPORTED_AGENTS.forEach((agent) => {
    if (detection[agent]?.detected) {
      delete overrides[agent];
    }
  });

  return normalizeAppOverrides(overrides);
};

const areAppOverridesEqual = (
  current?: RegistryServerEntry['apps'],
  next?: RegistryServerEntry['apps']
): boolean => {
  if (current === next) {
    return true;
  }

  const currentEntries = Object.entries(current ?? {});
  const nextEntries = Object.entries(next ?? {});

  if (currentEntries.length !== nextEntries.length) {
    return false;
  }

  return nextEntries.every(([key, value]) => (current ?? {})[key as SupportedAgent] === value);
};

const formatCommand = (server: RegistryServerEntry) => {
  const args = server.launch.args?.length ? ` ${server.launch.args.join(' ')}` : '';
  return `${server.launch.command}${args}`;
};

const resolveBridge = () => (typeof window !== 'undefined' ? window.relay : undefined);

const computeMasterState = (server: RegistryServerEntry, detection: DetectionSummary): MasterState => {
  if (!server.enabled) {
    return 'off';
  }

  const detectedAgents = SUPPORTED_AGENTS.filter((agent) => detection[agent]?.detected);
  if (detectedAgents.length === 0) {
    return 'off';
  }

  const allOn = detectedAgents.every((agent) => server.apps?.[agent] !== false);
  const allOff = detectedAgents.every((agent) => server.apps?.[agent] === false);

  if (allOn) {
    return 'on';
  }

  if (allOff) {
    return 'off';
  }

  return 'custom';
};

const App = () => {
  const bridge = resolveBridge();
  const versionLabel = typeof window !== 'undefined' ? window.relay?.version ?? 'dev' : 'dev';
  const [servers, setServers] = useState<RegistryServerEntry[]>(() =>
    bridge ? [] : fallbackRegistrySnapshot.servers
  );
  const [registryVersion, setRegistryVersion] = useState<number>(() =>
    bridge ? REGISTRY_VERSION : fallbackRegistrySnapshot.version
  );
  const [detection, setDetection] = useState<DetectionSummary>(() => (bridge ? buildDetectionSnapshot() : fallbackDetection));
  const [loading, setLoading] = useState(Boolean(bridge));
  const [loadError, setLoadError] = useState<string | null>(null);
  const [mutationError, setMutationError] = useState<string | null>(null);
  const [modalState, setModalState] = useState<ModalState>(null);

  useEffect(() => {
    if (!bridge) {
      return;
    }

    let cancelled = false;

    const hydrate = async () => {
      setLoading(true);
      try {
        const [registrySnapshot, detectionSnapshot] = await Promise.all([
          bridge.registry.read(),
          bridge.detection.status()
        ]);

        if (cancelled) {
          return;
        }

        setServers(registrySnapshot.servers);
        setRegistryVersion(registrySnapshot.version);
        setDetection(detectionSnapshot);
        setLoadError(null);
        setMutationError(null);
      } catch (error) {
        console.error('[relay] failed to load registry/detection snapshot', error);
        if (!cancelled) {
          setLoadError('Unable to load registry snapshot');
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    hydrate();

    return () => {
      cancelled = true;
    };
  }, [bridge]);

  const persistServers = useCallback(
    async (nextServers: RegistryServerEntry[]): Promise<boolean> => {
      if (!bridge) {
        return true;
      }

      try {
        const snapshot = await bridge.registry.write({
          snapshot: {
            version: registryVersion,
            servers: nextServers
          }
        });
        setServers(snapshot.servers);
        setRegistryVersion(snapshot.version);
        setMutationError(null);
        return true;
      } catch (error) {
        console.error('[relay] failed to save registry snapshot', error);
        setMutationError('Unable to save registry changes');
        return false;
      }
    },
    [bridge, registryVersion]
  );

  const handleServerModalSubmit = async (payload: ServerFormSubmitPayload) => {
    const secrets = payload.secrets;
    if (secrets.length > 0) {
      try {
        if (!bridge) {
          throw new Error('Keychain access is unavailable in preview mode.');
        }

        for (const secret of secrets) {
          const result = await bridge.keychain.save({ alias: secret.alias, secret: secret.secret });
          if (!result?.ok) {
            throw new Error(result?.error ?? 'Unable to store secret in Keychain.');
          }
        }
      } finally {
        secrets.forEach((entry) => {
          entry.secret = '';
        });
      }
    }

    const nextServers =
      payload.mode === 'add'
        ? [
            ...servers,
            {
              id: generateServerId(payload.data.name, servers),
              name: payload.data.name,
              enabled: payload.data.enabled,
              launch: {
                mode: 'command',
                command: payload.data.launch.command,
                args: payload.data.launch.args
              },
              env: payload.data.env,
              ...(payload.data.apps ? { apps: payload.data.apps } : {})
            }
          ]
        : servers.map((server) => {
            if (server.id !== payload.serverId) {
              return server;
            }
            const updated: RegistryServerEntry = {
              ...server,
              name: payload.data.name,
              enabled: payload.data.enabled,
              launch: {
                ...server.launch,
                mode: 'command',
                command: payload.data.launch.command,
                args: payload.data.launch.args
              },
              env: payload.data.env
            };
            if (payload.data.apps && Object.keys(payload.data.apps).length > 0) {
              updated.apps = payload.data.apps;
            } else {
              delete updated.apps;
            }
          return updated;
        });

    setMutationError(null);
    const previousServers = servers.slice();
    setServers(nextServers);
    const saved = await persistServers(nextServers);
    if (!saved) {
      setServers(previousServers);
      throw new Error('Unable to save registry changes.');
    }

    setModalState(null);
  };

  const handleMasterToggle = (serverId: string, targetState: MasterIntent) => {
    let changed = false;
    const nextServers = servers.map((server) => {
      if (server.id !== serverId) {
        return server;
      }

      const nextApps = deriveAppsForMasterToggle(server, detection, targetState);
      if (areAppOverridesEqual(server.apps, nextApps)) {
        return server;
      }

      changed = true;
      return nextApps ? { ...server, apps: nextApps } : { ...server, apps: undefined };
    });

    if (!changed) {
      return;
    }

    setMutationError(null);
    setServers(nextServers);
    void persistServers(nextServers);
  };

  const detectedCount = useMemo(
    () => SUPPORTED_AGENTS.filter((agent) => detection[agent]?.detected).length,
    [detection]
  );

  return (
    <main className="app-shell">
      <div className="app-layout">
        <header className="app-header">
          <div className="brand-cluster">
            <p className="eyebrow">Relay</p>
            <h1>Shared MCP Orchestrator</h1>
            <p className="subcopy">
              macOS-only shell keeps Cursor, Claude, and Codex servers in sync with deterministic IO, Keychain secrets, and
              offline defaults.
            </p>
          </div>
          <button className="settings-button" type="button" aria-label="Open settings panel">
            Settings
          </button>
        </header>
        <div className="content-grid">
          <section className="pane servers-pane" aria-labelledby="servers-heading">
            <div className="section-header">
              <div>
                <p className="section-eyebrow">Servers</p>
                <h2 id="servers-heading">Workspace registry</h2>
                <p className="section-subcopy">
                  {servers.length} server{servers.length === 1 ? '' : 's'} • {detectedCount} detected app
                  {detectedCount === 1 ? '' : 's'}
                </p>
              </div>
              <button className="ghost-button" type="button" onClick={() => setModalState({ mode: 'add' })}>
                Add server
              </button>
            </div>
            {loadError && <p className="inline-error">{loadError}</p>}
            {mutationError && <p className="inline-error">{mutationError}</p>}
            {loading ? (
              <p className="inline-hint">Loading servers…</p>
            ) : servers.length === 0 ? (
              <div className="empty-state">
                <p>No servers yet</p>
                <span>Use Add server to register your first shared MCP endpoint.</span>
              </div>
            ) : (
              <ul className="server-list">
                {servers.map((server) => {
                  const masterState = computeMasterState(server, detection);
                  return (
                    <li className="server-card" key={server.id}>
                      <div className="server-card-head">
                        <div>
                          <p className="server-name">{server.name}</p>
                          <p className="server-command">{formatCommand(server)}</p>
                        </div>
                        <div className="server-card-actions">
                          <button
                            type="button"
                            className="ghost-button ghost-button--compact"
                            onClick={() => setModalState({ mode: 'edit', serverId: server.id })}
                          >
                            Edit
                          </button>
                          <button
                            type="button"
                            className={`switch ${server.enabled ? 'switch--on' : 'switch--off'}`}
                            aria-pressed={server.enabled}
                          >
                            {server.enabled ? 'Enabled' : 'Disabled'}
                          </button>
                        </div>
                      </div>
                      <div className="apps-summary">
                        <div>
                          <p className="server-label">All apps</p>
                          <p className="server-hint">{masterLabels[masterState]}</p>
                        </div>
                        <button
                          type="button"
                          className={`switch switch--${masterState}`}
                          aria-pressed={masterState === 'on'}
                          onClick={() => handleMasterToggle(server.id, masterState === 'on' ? 'off' : 'on')}
                        >
                          {masterState === 'custom' ? 'Custom' : masterState === 'on' ? 'On' : 'Off'}
                        </button>
                      </div>
                      <div className="apps-row" role="group" aria-label="Per-app toggles">
                        {SUPPORTED_AGENTS.map((agent) => {
                          const status = detection[agent];
                          const detected = Boolean(status?.detected);
                          const effectiveEnabled = Boolean(server.enabled) && server.apps?.[agent] !== false;
                          const disabled = !detected || !server.enabled;

                          return (
                            <button
                              key={`${server.id}-${agent}`}
                              type="button"
                              className={`app-pill ${
                                effectiveEnabled ? 'app-pill--on' : 'app-pill--off'
                              } ${disabled ? 'app-pill--disabled' : ''}`}
                              disabled={disabled}
                              aria-pressed={effectiveEnabled}
                              data-agent={agent}
                            >
                              <span className="pill-label">{agentLabels[agent]}</span>
                              <span className="pill-state">
                                {!detected ? 'Not detected' : effectiveEnabled ? 'On' : 'Off'}
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
          <section className="pane detail-pane" aria-labelledby="overview-heading">
            <div className="section-header">
              <div>
                <p className="section-eyebrow">Overview</p>
                <h2 id="overview-heading">Relay status</h2>
              </div>
              <span className="badge">Offline-first</span>
            </div>
            <p className="detail-copy">
              Every UI action, tray entry, and scheduled sync routes through the same hardened services so registry, Keychain,
              and detection state stay deterministic even without a network connection.
            </p>
            <dl className="status-grid compact">
              <div>
                <dt>Version</dt>
                <dd>{versionLabel}</dd>
              </div>
              <div>
                <dt>Window</dt>
                <dd>900×600 | Liquid Glass</dd>
              </div>
              <div>
                <dt>Security</dt>
                <dd>Isolation + sandbox enforced</dd>
              </div>
              <div>
                <dt>Assets</dt>
                <dd>Local bundle • CSP locked</dd>
              </div>
            </dl>
          </section>
        </div>
        <footer className="app-footer">
          <span className="tag">Deterministic IO</span>
          <span className="tag">Keychain-only secrets</span>
          <span className="tag">No telemetry</span>
        </footer>
      </div>
      {modalState && (
        <ServerModal
          mode={modalState.mode}
          server={modalState.mode === 'edit' ? servers.find((server) => server.id === modalState.serverId) : undefined}
          detection={detection}
          existingServers={servers}
          onCancel={() => setModalState(null)}
          onSubmit={handleServerModalSubmit}
        />
      )}
    </main>
  );
};

export default App;
