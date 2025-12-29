import { useCallback, useEffect, useMemo, useState } from 'react';
import type {
  DetectionStatus,
  DetectionSummary,
  RegistryServerEntry,
  RegistrySnapshot,
  SyncStatusSnapshot,
  UpdateState,
  UpdateStatusSnapshot
} from '../../main/src/ipc/contracts';
import { REGISTRY_VERSION } from '../../main/src/registry/schema';
import type { SupportedAgent } from '../../main/src/types/agents';
import { SUPPORTED_AGENTS } from '../../main/src/types/agents';
import ServerModal, { type ServerFormSubmitPayload } from './components/ServerModal';

type SectionId = 'servers' | 'settings' | 'sync' | 'updates';

const ServersIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6}>
    <rect x="4" y="5" width="16" height="4" rx="1.5" />
    <rect x="4" y="13" width="16" height="4" rx="1.5" />
    <circle cx="8" cy="7" r="0.7" />
    <circle cx="8" cy="15" r="0.7" />
  </svg>
);

const SettingsIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6}>
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M6 7.5h6m3.5 0H18M7.5 7.5a1.5 1.5 0 1 1 3 0m-4.5 9h6m3.5 0H18m-9-4.5H18m-8.5 0a1.5 1.5 0 1 0 3 0"
    />
  </svg>
);

const SyncIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6}>
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M7 11a5 5 0 0 1 8.5-3.5M17 13a5 5 0 0 1-8.5 3.5"
    />
    <path strokeLinecap="round" strokeLinejoin="round" d="M6.5 9.5 9 7m-2.5 2.5V7" />
    <path strokeLinecap="round" strokeLinejoin="round" d="M17.5 14.5 15 17m2.5-2.5V17" />
  </svg>
);

const UpdatesIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v9m0-9 3 3m-3-3-3 3" />
    <rect x="5" y="15" width="14" height="3" rx="1.2" />
  </svg>
);

const SIDEBAR_SECTIONS: { id: SectionId; label: string; icon: React.ReactElement }[] = [
  { id: 'servers', label: 'MCP Servers', icon: <ServersIcon /> },
  { id: 'settings', label: 'Settings', icon: <SettingsIcon /> },
  { id: 'sync', label: 'Sync', icon: <SyncIcon /> },
  { id: 'updates', label: 'Updates', icon: <UpdatesIcon /> }
];

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

const buildFallbackSyncStatus = (): SyncStatusSnapshot => ({
  state: 'idle',
  lastRun: new Date(Date.now() - 1000 * 60 * 30).toISOString()
});

const buildFallbackUpdateStatus = (version: string): UpdateStatusSnapshot => ({
  state: 'up_to_date',
  currentVersion: version,
  latestVersion: version,
  checkedAt: new Date().toISOString(),
  message: 'Preview mode: updates are mocked.',
  autoCheckEnabled: true
});

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

const updateStateLabels: Record<UpdateState, string> = {
  idle: 'Idle',
  checking: 'Checking…',
  up_to_date: 'Up to date',
  update_available: 'Update available',
  offline: 'Offline',
  error: 'Error'
};

const formatTimestamp = (isoValue?: string | null): string => {
  if (!isoValue) {
    return 'Never';
  }

  const value = new Date(isoValue);
  if (Number.isNaN(value.getTime())) {
    return 'Never';
  }

  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short'
  }).format(value);
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
    if (!acc) acc = {};
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
      if (!acc) acc = {};
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
  const [syncStatus, setSyncStatus] = useState<SyncStatusSnapshot>(() =>
    bridge ? { state: 'idle', lastRun: null } : buildFallbackSyncStatus()
  );
  const [syncBusy, setSyncBusy] = useState(false);
  const [detectionBusy, setDetectionBusy] = useState(false);
  const [detectionError, setDetectionError] = useState<string | null>(null);
  const [updateStatus, setUpdateStatus] = useState<UpdateStatusSnapshot>(() =>
    buildFallbackUpdateStatus(versionLabel)
  );
  const [updateBusy, setUpdateBusy] = useState(false);
  const [updateError, setUpdateError] = useState<string | null>(null);
  const [loading, setLoading] = useState(Boolean(bridge));
  const [loadError, setLoadError] = useState<string | null>(null);
  const [mutationError, setMutationError] = useState<string | null>(null);
  const [modalState, setModalState] = useState<ModalState>(null);
  const [activeSection, setActiveSection] = useState<SectionId>('servers');

  // Keyboard navigation handler
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // Escape key closes modal
      if (event.key === 'Escape' && modalState) {
        setModalState(null);
      }

      // Ctrl/Cmd + K for quick add server (if modal is not open)
      if ((event.metaKey || event.ctrlKey) && event.key === 'k' && !modalState) {
        event.preventDefault();
        setModalState({ mode: 'add', server: undefined } as any);
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [modalState]);

  useEffect(() => {
    if (!bridge) {
      return;
    }

    let cancelled = false;

    const hydrate = async () => {
      setLoading(true);
      try {
        const [registrySnapshot, detectionSnapshot, syncSnapshot, updateSnapshot] = await Promise.all([
          bridge.registry.read(),
          bridge.detection.status(),
          bridge.sync.status(),
          bridge.updates.status()
        ]);

        if (cancelled) {
          return;
        }

        setServers(registrySnapshot.servers);
        setRegistryVersion(registrySnapshot.version);
        setDetection(detectionSnapshot);
        setSyncStatus(syncSnapshot);
        setUpdateStatus(updateSnapshot);
        setLoadError(null);
        setMutationError(null);
        setUpdateError(null);
        setDetectionError(null);
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

  const handleSectionChange = useCallback((section: SectionId) => {
    setActiveSection(section);
  }, []);

  const handleSyncNow = useCallback(async () => {
    if (syncBusy) {
      return;
    }

    setSyncBusy(true);
    setSyncStatus((prev) => ({ ...prev, state: 'running', lastError: undefined }));

    try {
      if (!bridge) {
        await new Promise((resolve) => setTimeout(resolve, 250));
        setSyncStatus({
          state: 'idle',
          lastRun: new Date().toISOString()
        });
        return;
      }

      const result = await bridge.sync.invoke({ source: 'user' });
      setSyncStatus({
        state: result.ok ? 'idle' : 'error',
        lastRun: result.finishedAt,
        lastError: result.ok ? undefined : result.message
      });
    } catch (error) {
      console.error('[relay] sync failed', error);
      setSyncStatus((prev) => ({
        ...prev,
        state: 'error',
        lastError: 'Unable to run sync.'
      }));
    } finally {
      setSyncBusy(false);
    }
  }, [bridge, syncBusy]);

  const handleDetectionRefresh = useCallback(async () => {
    if (!bridge || detectionBusy) {
      return;
    }

    setDetectionBusy(true);
    setDetectionError(null);
    try {
      const snapshot = await bridge.detection.refresh();
      setDetection(snapshot);
    } catch (error) {
      console.error('[relay] failed to refresh detection snapshot', error);
      setDetectionError('Unable to refresh agent detection.');
    } finally {
      setDetectionBusy(false);
    }
  }, [bridge, detectionBusy]);

  const handleUpdateCheck = useCallback(async () => {
    if (updateBusy) {
      return;
    }

    setUpdateBusy(true);
    setUpdateError(null);
    setUpdateStatus((prev) => ({ ...prev, state: 'checking' }));

    try {
      if (!bridge) {
        await new Promise((resolve) => setTimeout(resolve, 250));
        setUpdateStatus((prev) => ({
          ...prev,
          state: 'up_to_date',
          latestVersion: prev.currentVersion,
          checkedAt: new Date().toISOString(),
          message: 'Preview mode: updates are mocked.'
        }));
        return;
      }

      const snapshot = await bridge.updates.check({ source: 'manual' });
      setUpdateStatus(snapshot);
    } catch (error) {
      console.error('[relay] update check failed', error);
      setUpdateStatus((prev) => ({
        ...prev,
        state: 'error',
        checkedAt: new Date().toISOString(),
        message: 'Unable to check for updates.'
      }));
      setUpdateError('Unable to check for updates.');
    } finally {
      setUpdateBusy(false);
    }
  }, [bridge, updateBusy]);

  const handleUpdatePreferenceToggle = useCallback(async () => {
    const nextEnabled = !updateStatus.autoCheckEnabled;

    try {
      if (!bridge) {
        setUpdateStatus((prev) => ({
          ...prev,
          autoCheckEnabled: nextEnabled
        }));
        return;
      }

      const snapshot = await bridge.updates.preference({ autoCheckEnabled: nextEnabled });
      setUpdateStatus(snapshot);
      setUpdateError(null);
    } catch (error) {
      console.error('[relay] failed to store update preference', error);
      setUpdateError('Unable to update preference.');
    }
  }, [bridge, updateStatus.autoCheckEnabled]);

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
    setServers(nextServers as any);
    const saved = await persistServers(nextServers as any);
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

  const handleAgentToggle = (serverId: string, agent: SupportedAgent) => {
    const agentDetected = Boolean(detection[agent]?.detected);
    if (!agentDetected) {
      return;
    }

    let changed = false;
    const nextServers = servers.map((server) => {
      if (server.id !== serverId || !server.enabled) {
        return server;
      }

      const overrides = { ...(server.apps ?? {}) };
      const currentlyDisabled = server.apps?.[agent] === false;

      if (currentlyDisabled) {
        delete overrides[agent];
      } else {
        overrides[agent] = false;
      }

      const normalized = normalizeAppOverrides(overrides);
      if (areAppOverridesEqual(server.apps, normalized)) {
        return server;
      }

      changed = true;
      if (normalized) {
        return { ...server, apps: normalized };
      }
      const nextServer = { ...server };
      delete nextServer.apps;
      return nextServer;
    });

    if (!changed) {
      return;
    }

    setMutationError(null);
    setServers(nextServers);
    void persistServers(nextServers);
  };

  const handleRemoveServer = async (serverId: string) => {
    const target = servers.find((server) => server.id === serverId);
    if (!target) {
      return;
    }

    const confirmed =
      typeof window === 'undefined'
        ? true
        : window.confirm(
          `Remove "${target.name}"? This deletes the registry entry and lets Keychain drop unused secrets.`
        );
    if (!confirmed) {
      return;
    }

    const nextServers = servers.filter((server) => server.id !== serverId);
    if (nextServers.length === servers.length) {
      return;
    }

    setMutationError(null);
    const previousServers = servers.slice();
    setServers(nextServers);
    const saved = await persistServers(nextServers);
    if (!saved) {
      setServers(previousServers);
    }
  };

  const detectedCount = useMemo(
    () => SUPPORTED_AGENTS.filter((agent) => detection[agent]?.detected).length,
    [detection]
  );

  const sectionContent: Record<SectionId, React.ReactElement> = {
    servers: (
      <div aria-labelledby="servers-heading">
        <header>
          <div>
            <p>Servers</p>
            <h2 id="servers-heading">Workspace registry</h2>
            <p>
              {servers.length} server{servers.length === 1 ? '' : 's'} • {detectedCount} detected app
              {detectedCount === 1 ? '' : 's'}
            </p>
          </div>
          <button
            onClick={() => setModalState({ mode: 'add' })}
            type="button"
          >
            Add server
          </button>
        </header>
        <div>
          {loadError && <p>{loadError}</p>}
          {mutationError && <p>{mutationError}</p>}
          {loading ? (
            <div>
              <div>
                <span>Loading servers…</span>
              </div>
            </div>
          ) : servers.length === 0 ? (
            <div>
              <p>No servers yet</p>
              <p>Use Add server to register your first shared MCP endpoint.</p>
            </div>
          ) : (
            <ul>
              {servers.map((server) => {
                const masterState = computeMasterState(server, detection);
                return (
                  <li key={server.id}>
                    <div>
                      <div>
                        <p>{server.name}</p>
                        <p>
                          <code>{formatCommand(server)}</code>
                        </p>
                      </div>
                      <div>
                        <button
                          onClick={() => setModalState({ mode: 'edit', serverId: server.id })}
                          type="button"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => void handleRemoveServer(server.id)}
                          type="button"
                        >
                          Remove
                        </button>
                        <button
                          type="button"
                          aria-pressed={server.enabled}
                        >
                          {server.enabled ? 'Enabled' : 'Disabled'}
                        </button>
                      </div>
                    </div>
                    <div>
                      <div>
                        <div>
                          <span>All apps</span>
                          <span>{masterLabels[masterState]}</span>
                        </div>
                        <div>
                          <span>
                            {masterState === 'custom' ? 'Custom' : masterState === 'on' ? 'All on' : 'All off'}
                          </span>
                          <input
                            type="checkbox"
                            checked={masterState === 'on' || masterState === 'custom'}
                            onChange={(e) =>
                              handleMasterToggle(server.id, e.target.checked ? 'on' : 'off')
                            }
                          />
                        </div>
                      </div>
                    </div>
                    <div role="group" aria-label="Per-app toggles">
                      {SUPPORTED_AGENTS.map((agent) => {
                        const status = detection[agent];
                        const detected = Boolean(status?.detected);
                        const effectiveEnabled = Boolean(server.enabled) && server.apps?.[agent] !== false;
                        const disabled = !detected || !server.enabled;

                        return (
                          <div key={`${server.id}-${agent}`}>
                            <div>
                              <span>{agentLabels[agent]}</span>
                              <span>
                                {!detected ? 'Not detected' : effectiveEnabled ? 'Enabled' : 'Disabled'}
                              </span>
                            </div>
                            <input
                              type="checkbox"
                              checked={effectiveEnabled}
                              onChange={() => handleAgentToggle(server.id, agent)}
                              disabled={disabled}
                            />
                          </div>
                        );
                      })}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>
    ),
    settings: (
      <div aria-labelledby="detection-heading">
        <header>
          <div>
            <p>Settings</p>
            <h2 id="detection-heading">Agent detection</h2>
            <p>Resolved config paths are read-only and shared across Cursor, Claude, and Codex.</p>
          </div>
          {bridge && (
            <button
              type="button"
              disabled={detectionBusy}
              onClick={handleDetectionRefresh}
            >
              {detectionBusy ? 'Scanning…' : 'Re-scan'}
            </button>
          )}
        </header>
        <div>
          {detectionError && <p>{detectionError}</p>}
          <ul>
            {SUPPORTED_AGENTS.map((agent) => {
              const status = detection[agent];
              const detected = Boolean(status?.detected);
              return (
                <li key={`detection-${agent}`}>
                  <div>
                    <div>
                      <p>{agentLabels[agent]}</p>
                      <p>Read-only config path</p>
                    </div>
                    <span>
                      {detected ? 'Detected' : 'Not detected'}
                    </span>
                  </div>
                  <p title="Relay displays project-scoped configs in read-only mode.">
                    {status?.path ?? 'Unknown path'}
                  </p>
                  <p>Last checked {formatTimestamp(status?.lastChecked)}</p>
                </li>
              );
            })}
          </ul>
        </div>
      </div>
    ),
    sync: (
      <div aria-labelledby="sync-heading">
        <header>
          <div>
            <p>Sync</p>
            <h2 id="sync-heading">Deterministic writes</h2>
            <p>Invokes the same locked-down main-process service used by the tray and schedule.</p>
          </div>
          <span>
            {syncStatus.state === 'running' ? 'Syncing' : syncStatus.state === 'error' ? 'Error' : 'Ready'}
          </span>
        </header>
        <div>
          <div>
            <p>Last sync</p>
            <p>{formatTimestamp(syncStatus.lastRun)}</p>
            {syncStatus.lastError ? (
              <p>{syncStatus.lastError}</p>
            ) : (
              <p>Every detected agent uses this timestamp.</p>
            )}
          </div>
          <button
            type="button"
            onClick={handleSyncNow}
            disabled={syncBusy}
          >
            {syncStatus.state === 'running' ? 'Syncing…' : 'Sync Now'}
          </button>
        </div>
      </div>
    ),
    updates: (
      <div aria-labelledby="updates-heading">
        <header>
          <div>
            <p>Updates</p>
            <h2 id="updates-heading">Manifest checks</h2>
            <p>Manual checks stay in the main process and never include registry or secret data.</p>
          </div>
          <span>
            {updateStateLabels[updateStatus.state]}
          </span>
        </header>
        <div>
          <dl>
            <div>
              <dt>Current build</dt>
              <dd>{updateStatus.currentVersion}</dd>
            </div>
            <div>
              <dt>Latest manifest</dt>
              <dd>{updateStatus.latestVersion ?? '—'}</dd>
            </div>
            <div>
              <dt>Last checked</dt>
              <dd>{formatTimestamp(updateStatus.checkedAt)}</dd>
            </div>
          </dl>
          <p>{updateStatus.message ?? 'No update checks have run yet.'}</p>
          {updateError && <p>{updateError}</p>}
          <div>
            <button
              type="button"
              onClick={handleUpdateCheck}
              disabled={updateBusy}
            >
              {updateStatus.state === 'checking' ? 'Checking…' : 'Check for updates'}
            </button>
            <button
              type="button"
              role="switch"
              aria-checked={updateStatus.autoCheckEnabled}
              onClick={handleUpdatePreferenceToggle}
              disabled={updateBusy}
            >
              {updateStatus.autoCheckEnabled ? 'Auto checks on' : 'Auto checks off'}
            </button>
          </div>
        </div>
      </div>
    )
  };

  return (
    <main style={{ backgroundColor: 'white', minHeight: '100vh', color: 'black' }}>
      <aside>
        <div>
          <div>
            <div>R</div>
            <div>
              <p>Relay</p>
            </div>
          </div>
        </div>
        <nav aria-label="Primary">
          {SIDEBAR_SECTIONS.map((section) => {
            const isActive = activeSection === section.id;
            return (
              <button
                key={section.id}
                type="button"
                onClick={() => handleSectionChange(section.id)}
                aria-current={isActive ? 'page' : undefined}
              >
                <span>{section.icon}</span>
                <span>{section.label}</span>
              </button>
            );
          })}
        </nav>
      </aside>
      <div>
        <div>
          <header>
            <div>
              <p>Relay</p>
              <h1>Shared MCP Orchestrator</h1>
              <p>
                Shared MCP shell keeps Cursor, Claude, and Codex servers in sync with secure Keychain storage.
              </p>
            </div>
            <div>
              <button
                type="button"
                aria-label="Open settings panel"
                onClick={() => handleSectionChange('settings')}
              >
                Settings
              </button>
            </div>
          </header>
          <div>
            {SIDEBAR_SECTIONS.map((section) => {
              const isActive = activeSection === section.id;
              return (
                <section
                  key={`section-${section.id}`}
                  data-section={section.id}
                  aria-hidden={!isActive}
                  style={{ display: isActive ? 'block' : 'none' }}
                >
                  {sectionContent[section.id]}
                </section>
              );
            })}
          </div>
        </div>
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
