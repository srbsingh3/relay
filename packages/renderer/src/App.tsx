import { useCallback, useEffect, useMemo, useState } from 'react';
import './styles.css';
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
import { Badge } from './components/ui/badge';
import { Button } from './components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './components/ui/card';
import { cn } from './lib/utils';

const SETTINGS_SECTION_ID = 'settings-panel';

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

const masterStateStyles: Record<MasterState, string> = {
  on: 'border-emerald-400/60 bg-emerald-500/10 text-emerald-100',
  off: 'border-slate-600/70 bg-slate-800/60 text-slate-300',
  custom: 'border-sky-400/60 bg-sky-500/10 text-sky-100'
};

const appToggleStyles = {
  on: 'border-emerald-400/60 bg-emerald-500/10 text-emerald-50',
  off: 'border-white/10 bg-slate-900/40 text-slate-200'
};

const detectionStatusStyles = {
  detected: 'border-emerald-500/40 bg-emerald-500/10 text-emerald-100',
  missing: 'border-slate-600/60 bg-slate-900/60 text-slate-300'
};

const updateStateStyles: Record<
  UpdateState,
  {
    label: string;
    className: string;
  }
> = {
  idle: { label: 'Idle', className: 'border-slate-600/70 text-slate-200' },
  checking: { label: 'Checking…', className: 'border-sky-500/60 text-sky-200' },
  up_to_date: { label: 'Up to date', className: 'border-emerald-400/70 text-emerald-100' },
  update_available: { label: 'Update available', className: 'border-amber-400/70 text-amber-100' },
  offline: { label: 'Offline', className: 'border-slate-600/70 text-slate-300' },
  error: { label: 'Error', className: 'border-rose-500/70 text-rose-200' }
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
  const [syncStatus, setSyncStatus] = useState<SyncStatusSnapshot>(() =>
    bridge ? { state: 'idle', lastRun: null } : buildFallbackSyncStatus()
  );
  const [syncBusy, setSyncBusy] = useState(false);
  const [updateStatus, setUpdateStatus] = useState<UpdateStatusSnapshot>(() =>
    buildFallbackUpdateStatus(versionLabel)
  );
  const [updateBusy, setUpdateBusy] = useState(false);
  const [updateError, setUpdateError] = useState<string | null>(null);
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

  const scrollToSettings = useCallback(() => {
    if (typeof document === 'undefined') {
      return;
    }

    const target = document.getElementById(SETTINGS_SECTION_ID);
    target?.scrollIntoView({ behavior: 'smooth', block: 'start' });
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
        state: 'idle',
        lastRun: result.finishedAt,
        lastError: undefined
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

  return (
    <main className="relative min-h-screen bg-slate-950 font-sans text-slate-100 antialiased">
      <div className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute left-10 top-[-10%] h-64 w-64 rounded-full bg-sky-500/30 blur-[140px]" />
        <div className="absolute right-20 top-0 h-72 w-72 rounded-full bg-fuchsia-500/25 blur-[160px]" />
        <div className="absolute bottom-[-10%] left-1/3 h-80 w-96 rounded-full bg-emerald-500/25 blur-[200px]" />
      </div>
      <div className="relative z-10 mx-auto flex min-h-screen w-full max-w-6xl flex-col px-4 py-10 sm:px-6 lg:px-8">
        <div className="flex flex-1 flex-col gap-8 rounded-[34px] border border-white/10 bg-slate-950/80 p-6 shadow-[0_30px_80px_rgba(2,6,23,0.85)] backdrop-blur-3xl md:p-10">
          <header
            className="flex flex-col gap-6 md:flex-row md:items-start md:justify-between"
            style={{ WebkitAppRegion: 'drag' }}
          >
            <div className="space-y-3">
              <p className="text-xs font-semibold uppercase tracking-[0.3em] text-sky-300">Relay</p>
              <h1 className="text-3xl font-semibold sm:text-4xl">Shared MCP Orchestrator</h1>
              <p className="max-w-2xl text-base text-slate-400">
                macOS-only shell keeps Cursor, Claude, and Codex servers in sync with deterministic IO, Keychain secrets, and
                offline defaults.
              </p>
            </div>
            <Button
              variant="outline"
              className="self-start rounded-full border-white/15 text-xs uppercase tracking-[0.2em]"
              style={{ WebkitAppRegion: 'no-drag' }}
              type="button"
              aria-label="Open settings panel"
              onClick={scrollToSettings}
            >
              Settings
            </Button>
          </header>
          <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
            <Card
              className="p-6"
              aria-labelledby="servers-heading"
            >
              <CardHeader className="flex flex-col gap-4 pb-2 md:flex-row md:items-start md:justify-between">
                <div className="space-y-1.5">
                  <p className="text-xs uppercase tracking-[0.24em] text-sky-300">Servers</p>
                  <CardTitle id="servers-heading" className="text-2xl">
                    Workspace registry
                  </CardTitle>
                  <CardDescription>
                    {servers.length} server{servers.length === 1 ? '' : 's'} • {detectedCount} detected app
                    {detectedCount === 1 ? '' : 's'}
                  </CardDescription>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  className="rounded-full border-white/15 text-xs uppercase tracking-[0.2em]"
                  onClick={() => setModalState({ mode: 'add' })}
                  type="button"
                >
                  Add server
                </Button>
              </CardHeader>
              <CardContent className="space-y-4">
                {loadError && <p className="text-sm text-rose-300">{loadError}</p>}
                {mutationError && <p className="text-sm text-rose-300">{mutationError}</p>}
                {loading ? (
                  <p className="text-sm text-slate-400">Loading servers…</p>
                ) : servers.length === 0 ? (
                  <div className="rounded-2xl border border-white/5 bg-slate-900/40 p-6 text-center text-sm text-slate-400">
                    <p className="text-base font-medium text-slate-200">No servers yet</p>
                    <span>Use Add server to register your first shared MCP endpoint.</span>
                  </div>
                ) : (
                  <ul className="space-y-4">
                    {servers.map((server) => {
                      const masterState = computeMasterState(server, detection);
                      return (
                        <li
                          key={server.id}
                          className="rounded-[26px] border border-white/10 bg-slate-950/60 p-5 shadow-[0_15px_45px_rgba(2,6,23,0.55)] backdrop-blur-xl"
                        >
                          <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                            <div>
                              <p className="text-lg font-semibold text-white">{server.name}</p>
                              <p className="mt-2 text-xs text-slate-400">
                                <code className="rounded-lg bg-slate-900/60 px-3 py-1 font-mono text-sm text-slate-100">
                                  {formatCommand(server)}
                                </code>
                              </p>
                            </div>
                            <div className="flex flex-wrap items-center gap-2">
                              <Button
                                variant="ghost"
                                size="sm"
                                className="rounded-full border border-white/15 text-[0.7rem] uppercase tracking-[0.2em]"
                                onClick={() => setModalState({ mode: 'edit', serverId: server.id })}
                                type="button"
                              >
                                Edit
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="rounded-full border border-rose-400/40 text-[0.7rem] uppercase tracking-[0.2em] text-rose-200 transition hover:border-rose-300 hover:text-rose-100"
                                onClick={() => void handleRemoveServer(server.id)}
                                type="button"
                              >
                                Remove
                              </Button>
                              <button
                                type="button"
                                aria-pressed={server.enabled}
                                className={cn(
                                  'rounded-full border px-4 py-1.5 text-[0.65rem] font-semibold uppercase tracking-[0.25em]',
                                  server.enabled
                                    ? 'border-emerald-400/60 bg-emerald-500/15 text-emerald-100'
                                    : 'border-slate-700/70 bg-slate-900/60 text-slate-300'
                                )}
                              >
                                {server.enabled ? 'Enabled' : 'Disabled'}
                              </button>
                            </div>
                          </div>
                          <div className="mt-4 rounded-2xl border border-white/5 bg-slate-900/40 px-4 py-3 md:mt-3">
                            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                              <div>
                                <p className="text-[0.65rem] uppercase tracking-[0.3em] text-slate-400">All apps</p>
                                <p className="text-sm text-slate-200">{masterLabels[masterState]}</p>
                              </div>
                              <button
                                type="button"
                                className={cn(
                                  'rounded-full border px-5 py-2 text-xs font-semibold uppercase tracking-[0.3em] transition',
                                  masterStateStyles[masterState]
                                )}
                                aria-pressed={masterState === 'on'}
                                onClick={() => handleMasterToggle(server.id, masterState === 'on' ? 'off' : 'on')}
                              >
                                {masterState === 'custom' ? 'Custom' : masterState === 'on' ? 'On' : 'Off'}
                              </button>
                            </div>
                          </div>
                          <div className="mt-4 flex flex-wrap gap-3" role="group" aria-label="Per-app toggles">
                            {SUPPORTED_AGENTS.map((agent) => {
                              const status = detection[agent];
                              const detected = Boolean(status?.detected);
                              const effectiveEnabled = Boolean(server.enabled) && server.apps?.[agent] !== false;
                              const disabled = !detected || !server.enabled;

                              return (
                                <button
                                  key={`${server.id}-${agent}`}
                                  type="button"
                                  className={cn(
                                    'flex min-w-[130px] flex-col rounded-2xl border px-4 py-3 text-left text-xs uppercase tracking-[0.25em] transition',
                                    effectiveEnabled ? appToggleStyles.on : appToggleStyles.off,
                                    disabled ? 'cursor-not-allowed opacity-40' : 'hover:border-white/40'
                                  )}
                                  disabled={disabled}
                                  aria-pressed={effectiveEnabled}
                                  data-agent={agent}
                                  onClick={() => handleAgentToggle(server.id, agent)}
                                >
                                  <span className="text-[0.65rem]">{agentLabels[agent]}</span>
                                  <span className="text-base font-semibold tracking-normal text-white">
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
              </CardContent>
            </Card>
            <div id={SETTINGS_SECTION_ID} className="flex flex-col gap-6">
              <Card className="p-6" aria-labelledby="detection-heading">
                <CardHeader className="flex flex-col gap-1.5 pb-3">
                  <p className="text-xs uppercase tracking-[0.24em] text-sky-300">Settings</p>
                  <CardTitle id="detection-heading">Agent detection</CardTitle>
                  <CardDescription>Resolved config paths are read-only and shared across Cursor, Claude, and Codex.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <ul className="space-y-3">
                    {SUPPORTED_AGENTS.map((agent) => {
                      const status = detection[agent];
                      const detected = Boolean(status?.detected);
                      const badgeStyle = detected ? detectionStatusStyles.detected : detectionStatusStyles.missing;
                      return (
                        <li
                          key={`detection-${agent}`}
                          className="rounded-2xl border border-white/5 bg-slate-900/40 p-4"
                        >
                          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                            <div>
                              <p className="text-sm font-semibold text-white">{agentLabels[agent]}</p>
                              <p className="text-xs text-slate-400">Read-only config path</p>
                            </div>
                            <Badge
                              variant="outline"
                              className={cn('rounded-full px-3 py-1 text-[0.65rem] uppercase tracking-[0.3em]', badgeStyle)}
                            >
                              {detected ? 'Detected' : 'Not detected'}
                            </Badge>
                          </div>
                          <p className="mt-3 truncate font-mono text-sm text-slate-200">{status?.path ?? 'Unknown path'}</p>
                          <p className="mt-1 text-xs text-slate-500">Last checked {formatTimestamp(status?.lastChecked)}</p>
                        </li>
                      );
                    })}
                  </ul>
                </CardContent>
              </Card>
              <Card className="p-6" aria-labelledby="sync-heading">
                <CardHeader className="flex items-start justify-between gap-4 pb-3">
                  <div className="space-y-1">
                    <p className="text-xs uppercase tracking-[0.24em] text-sky-300">Sync</p>
                    <CardTitle id="sync-heading">Deterministic writes</CardTitle>
                    <CardDescription>Invokes the same locked-down main-process service used by the tray and schedule.</CardDescription>
                  </div>
                  <Badge
                    variant="outline"
                    className={cn(
                      'text-[0.65rem] uppercase tracking-[0.3em]',
                      syncStatus.state === 'running'
                        ? 'border-sky-400/70 text-sky-200'
                        : syncStatus.state === 'error'
                          ? 'border-rose-500/70 text-rose-200'
                          : 'border-emerald-400/70 text-emerald-100'
                    )}
                  >
                    {syncStatus.state === 'running' ? 'Syncing' : syncStatus.state === 'error' ? 'Error' : 'Ready'}
                  </Badge>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="rounded-2xl border border-white/5 bg-slate-900/40 p-4">
                    <p className="text-xs uppercase tracking-[0.3em] text-slate-400">Last sync</p>
                    <p className="mt-1 text-lg font-semibold text-white">{formatTimestamp(syncStatus.lastRun)}</p>
                    {syncStatus.lastError ? (
                      <p className="mt-1 text-sm text-rose-300">{syncStatus.lastError}</p>
                    ) : (
                      <p className="mt-1 text-sm text-slate-400">Every detected agent uses this timestamp.</p>
                    )}
                  </div>
                  <Button
                    type="button"
                    onClick={handleSyncNow}
                    disabled={syncBusy}
                    className="w-full rounded-full text-xs uppercase tracking-[0.3em]"
                  >
                    {syncStatus.state === 'running' ? 'Syncing…' : 'Sync Now'}
                  </Button>
                </CardContent>
              </Card>
              <Card className="p-6" aria-labelledby="updates-heading">
                <CardHeader className="flex items-start justify-between gap-4 pb-3">
                  <div className="space-y-1">
                    <p className="text-xs uppercase tracking-[0.24em] text-sky-300">Updates</p>
                    <CardTitle id="updates-heading">Manifest checks</CardTitle>
                    <CardDescription>Manual checks stay in the main process and never include registry or secret data.</CardDescription>
                  </div>
                  <Badge
                    variant="outline"
                    className={cn(
                      'text-[0.65rem] uppercase tracking-[0.3em]',
                      updateStateStyles[updateStatus.state].className
                    )}
                  >
                    {updateStateStyles[updateStatus.state].label}
                  </Badge>
                </CardHeader>
                <CardContent className="space-y-4 text-sm text-slate-200">
                  <dl className="grid grid-cols-1 gap-3 text-sm text-slate-200">
                    <div className="rounded-2xl border border-white/5 bg-slate-900/40 p-4">
                      <dt className="text-xs uppercase tracking-wide text-slate-500">Current build</dt>
                      <dd className="text-base font-medium text-white">{updateStatus.currentVersion}</dd>
                    </div>
                    <div className="rounded-2xl border border-white/5 bg-slate-900/40 p-4">
                      <dt className="text-xs uppercase tracking-wide text-slate-500">Latest manifest</dt>
                      <dd className="text-base font-medium text-white">{updateStatus.latestVersion ?? '—'}</dd>
                    </div>
                    <div className="rounded-2xl border border-white/5 bg-slate-900/40 p-4">
                      <dt className="text-xs uppercase tracking-wide text-slate-500">Last checked</dt>
                      <dd className="text-base font-medium text-white">{formatTimestamp(updateStatus.checkedAt)}</dd>
                    </div>
                  </dl>
                  <p className="text-xs text-slate-400">{updateStatus.message ?? 'No update checks have run yet.'}</p>
                  {updateError && <p className="text-xs text-rose-300">{updateError}</p>}
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={handleUpdateCheck}
                      disabled={updateBusy}
                      className="flex-1 rounded-full text-xs uppercase tracking-[0.3em]"
                    >
                      {updateStatus.state === 'checking' ? 'Checking…' : 'Check for updates'}
                    </Button>
                    <button
                      type="button"
                      role="switch"
                      aria-checked={updateStatus.autoCheckEnabled}
                      onClick={handleUpdatePreferenceToggle}
                      disabled={updateBusy}
                      className={cn(
                        'w-full rounded-full border px-4 py-2 text-center text-[0.65rem] font-semibold uppercase tracking-[0.3em] transition sm:w-auto',
                        updateStatus.autoCheckEnabled
                          ? 'border-emerald-400/70 text-emerald-100'
                          : 'border-slate-600/70 text-slate-300'
                      )}
                    >
                      {updateStatus.autoCheckEnabled ? 'Auto checks on' : 'Auto checks off'}
                    </button>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
          <footer className="flex flex-wrap gap-2 text-xs uppercase tracking-[0.25em] text-slate-400">
            <Badge variant="outline" className="border-white/10 bg-transparent px-4 py-2 text-[0.7rem]">
              Deterministic IO
            </Badge>
            <Badge variant="outline" className="border-white/10 bg-transparent px-4 py-2 text-[0.7rem]">
              Keychain-only secrets
            </Badge>
            <Badge variant="outline" className="border-white/10 bg-transparent px-4 py-2 text-[0.7rem]">
              No telemetry
            </Badge>
          </footer>
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
