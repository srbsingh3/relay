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
import { ModeToggle } from './components/mode-toggle';
import { ThemeProvider } from './components/theme-provider';
import { cn } from './lib/utils';

type SectionId = 'servers' | 'settings' | 'sync' | 'updates';

const ServersIcon = () => (
  <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={1.6}>
    <rect x="4" y="5" width="16" height="4" rx="1.5" />
    <rect x="4" y="13" width="16" height="4" rx="1.5" />
    <circle cx="8" cy="7" r="0.7" />
    <circle cx="8" cy="15" r="0.7" />
  </svg>
);

const SettingsIcon = () => (
  <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={1.6}>
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M6 7.5h6m3.5 0H18M7.5 7.5a1.5 1.5 0 1 1 3 0m-4.5 9h6m3.5 0H18m-9-4.5H18m-8.5 0a1.5 1.5 0 1 0 3 0"
    />
  </svg>
);

const SyncIcon = () => (
  <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={1.6}>
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
  <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={1.6}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v9m0-9 3 3m-3-3-3 3" />
    <rect x="5" y="15" width="14" height="3" rx="1.2" />
  </svg>
);

const SIDEBAR_SECTIONS: { id: SectionId; label: string; icon: JSX.Element }[] = [
  { id: 'servers', label: 'Servers', icon: <ServersIcon /> },
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

const masterStateStyles: Record<MasterState, string> = {
  on: 'border-emerald-500/60 bg-emerald-500/10 text-emerald-700 dark:text-emerald-100',
  off: 'border-border bg-muted text-muted-foreground',
  custom: 'border-sky-500/70 bg-sky-500/15 text-sky-700 dark:text-sky-100'
};

const appToggleStyles = {
  on: 'border-emerald-500/70 bg-emerald-500/10 text-emerald-700 dark:text-emerald-100',
  off: 'border-border bg-muted text-muted-foreground'
};

const detectionStatusStyles = {
  detected: 'border-emerald-500/60 bg-emerald-500/10 text-emerald-700 dark:text-emerald-100',
  missing: 'border-border bg-muted text-muted-foreground'
};

const updateStateStyles: Record<
  UpdateState,
  {
    label: string;
    className: string;
  }
> = {
  idle: { label: 'Idle', className: 'border-border text-muted-foreground' },
  checking: { label: 'Checking…', className: 'border-sky-500/70 text-sky-700 dark:text-sky-100' },
  up_to_date: { label: 'Up to date', className: 'border-emerald-500/70 text-emerald-700 dark:text-emerald-100' },
  update_available: { label: 'Update available', className: 'border-amber-500/70 text-amber-700 dark:text-amber-100' },
  offline: { label: 'Offline', className: 'border-border text-muted-foreground' },
  error: { label: 'Error', className: 'border-rose-500/70 text-rose-700 dark:text-rose-100' }
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

  const sectionContent: Record<SectionId, JSX.Element> = {
    servers: (
      <Card className="p-6" aria-labelledby="servers-heading">
            <CardHeader className="flex flex-col gap-4 pb-2 md:flex-row md:items-start md:justify-between">
              <div className="space-y-1.5">
                <p className="text-xs uppercase tracking-[0.24em] text-primary/70">Servers</p>
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
                className="text-xs font-semibold text-muted-foreground"
                onClick={() => setModalState({ mode: 'add' })}
                type="button"
              >
                Add server
              </Button>
            </CardHeader>
            <CardContent className="space-y-4">
              {loadError && <p className="text-sm text-rose-600 dark:text-rose-300">{loadError}</p>}
              {mutationError && <p className="text-sm text-rose-600 dark:text-rose-300">{mutationError}</p>}
              {loading ? (
                <p className="text-sm text-muted-foreground">Loading servers…</p>
              ) : servers.length === 0 ? (
                <div className="rounded-lg border border-border/60 bg-muted/60 p-6 text-center text-sm text-muted-foreground">
                  <p className="text-base font-medium text-foreground/90">No servers yet</p>
                  <span>Use Add server to register your first shared MCP endpoint.</span>
                </div>
              ) : (
                <ul className="space-y-4">
                  {servers.map((server) => {
                    const masterState = computeMasterState(server, detection);
                    return (
                      <li key={server.id} className="rounded-lg border border-border bg-card p-5">
                        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                          <div>
                            <p className="text-lg font-semibold text-foreground">{server.name}</p>
                            <p className="mt-2 text-xs text-muted-foreground">
                              <code className="rounded-md bg-muted/60 px-3 py-1 font-mono text-sm text-foreground">
                                {formatCommand(server)}
                              </code>
                            </p>
                          </div>
                          <div className="flex flex-wrap items-center gap-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-xs font-semibold text-muted-foreground"
                              onClick={() => setModalState({ mode: 'edit', serverId: server.id })}
                              type="button"
                            >
                              Edit
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-xs font-semibold text-rose-600 transition hover:text-rose-700 dark:text-rose-200 dark:hover:text-rose-100"
                              onClick={() => void handleRemoveServer(server.id)}
                              type="button"
                            >
                              Remove
                            </Button>
                            <button
                              type="button"
                              aria-pressed={server.enabled}
                              className={cn(
                                'rounded-md border px-3 py-1.5 text-xs font-semibold transition',
                                server.enabled
                                  ? 'border-emerald-500/70 bg-emerald-500/10 text-emerald-700 dark:text-emerald-100'
                                  : 'border-border bg-muted text-muted-foreground'
                              )}
                            >
                              {server.enabled ? 'Enabled' : 'Disabled'}
                            </button>
                          </div>
                        </div>
                        <div className="mt-4 rounded-lg border border-border/60 bg-muted/60 px-4 py-3 md:mt-3">
                          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                            <div>
                              <p className="text-[0.7rem] uppercase tracking-[0.2em] text-muted-foreground">All apps</p>
                              <p className="text-sm text-foreground/90">{masterLabels[masterState]}</p>
                            </div>
                            <button
                              type="button"
                              className={cn(
                                'rounded-md border px-4 py-2 text-xs font-semibold transition',
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
                                  'flex min-w-[130px] flex-col rounded-md border px-4 py-3 text-left text-xs uppercase tracking-[0.18em] transition',
                                  effectiveEnabled ? appToggleStyles.on : appToggleStyles.off,
                                  disabled ? 'cursor-not-allowed opacity-40' : 'hover:border-ring/70'
                                )}
                                disabled={disabled}
                                aria-pressed={effectiveEnabled}
                                data-agent={agent}
                                onClick={() => handleAgentToggle(server.id, agent)}
                              >
                                <span className="text-[0.65rem]">{agentLabels[agent]}</span>
                                <span className="text-base font-semibold tracking-normal text-foreground">
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
    ),
    settings: (
      <Card className="p-6" aria-labelledby="detection-heading">
            <CardHeader className="flex flex-col gap-3 pb-3 md:flex-row md:items-center md:justify-between">
              <div>
                <p className="text-xs uppercase tracking-[0.24em] text-primary/70">Settings</p>
                <CardTitle id="detection-heading">Agent detection</CardTitle>
                <CardDescription>Resolved config paths are read-only and shared across Cursor, Claude, and Codex.</CardDescription>
              </div>
              {bridge && (
                <Button
                  variant="outline"
                  size="sm"
                  className="text-[0.75rem] font-semibold text-muted-foreground"
                  type="button"
                  disabled={detectionBusy}
                  onClick={handleDetectionRefresh}
                >
                  {detectionBusy ? 'Scanning…' : 'Re-scan'}
                </Button>
              )}
            </CardHeader>
            <CardContent className="space-y-4">
              {detectionError && <p className="text-sm text-rose-600 dark:text-rose-300">{detectionError}</p>}
              <ul className="space-y-3">
                {SUPPORTED_AGENTS.map((agent) => {
                  const status = detection[agent];
                  const detected = Boolean(status?.detected);
                  const badgeStyle = detected ? detectionStatusStyles.detected : detectionStatusStyles.missing;
                  return (
                    <li key={`detection-${agent}`} className="rounded-lg border border-border/60 bg-muted/60 p-4">
                      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                        <div>
                          <p className="text-sm font-semibold text-foreground">{agentLabels[agent]}</p>
                          <p className="text-xs text-muted-foreground">Read-only config path</p>
                        </div>
                        <Badge variant="outline" className={cn('px-3 py-1 text-[0.65rem] uppercase tracking-[0.2em]', badgeStyle)}>
                          {detected ? 'Detected' : 'Not detected'}
                        </Badge>
                      </div>
                      <p
                        className="mt-3 truncate font-mono text-sm text-foreground/90"
                        data-readonly="config-path"
                        title="Relay displays project-scoped configs in read-only mode."
                      >
                        {status?.path ?? 'Unknown path'}
                      </p>
                      <p className="mt-1 text-xs text-muted-foreground/80">Last checked {formatTimestamp(status?.lastChecked)}</p>
                    </li>
                  );
                })}
              </ul>
            </CardContent>
          </Card>
    ),
    sync: (
      <Card className="p-6" aria-labelledby="sync-heading">
            <CardHeader className="flex items-start justify-between gap-4 pb-3">
              <div className="space-y-1">
                <p className="text-xs uppercase tracking-[0.24em] text-primary/70">Sync</p>
                <CardTitle id="sync-heading">Deterministic writes</CardTitle>
                <CardDescription>Invokes the same locked-down main-process service used by the tray and schedule.</CardDescription>
              </div>
              <Badge
                variant="outline"
                className={cn(
                  'text-[0.65rem] uppercase tracking-[0.3em]',
                  syncStatus.state === 'running'
                    ? 'border-sky-500/70 text-sky-700 dark:text-sky-200'
                    : syncStatus.state === 'error'
                      ? 'border-rose-500/70 text-rose-700 dark:text-rose-200'
                      : 'border-emerald-500/70 text-emerald-700 dark:text-emerald-100'
                )}
              >
                {syncStatus.state === 'running' ? 'Syncing' : syncStatus.state === 'error' ? 'Error' : 'Ready'}
              </Badge>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="rounded-lg border border-border/60 bg-muted/60 p-4">
                <p className="text-xs uppercase tracking-[0.3em] text-muted-foreground">Last sync</p>
                <p className="mt-1 text-lg font-semibold text-foreground">{formatTimestamp(syncStatus.lastRun)}</p>
                {syncStatus.lastError ? (
                  <p className="mt-1 text-sm text-rose-600 dark:text-rose-300">{syncStatus.lastError}</p>
                ) : (
                  <p className="mt-1 text-sm text-muted-foreground">Every detected agent uses this timestamp.</p>
                )}
              </div>
              <Button
                type="button"
                onClick={handleSyncNow}
                disabled={syncBusy}
                className="w-full text-xs font-semibold uppercase tracking-[0.2em]"
              >
                {syncStatus.state === 'running' ? 'Syncing…' : 'Sync Now'}
              </Button>
            </CardContent>
          </Card>
    ),
    updates: (
      <Card className="p-6" aria-labelledby="updates-heading">
            <CardHeader className="flex items-start justify-between gap-4 pb-3">
              <div className="space-y-1">
                <p className="text-xs uppercase tracking-[0.24em] text-primary/70">Updates</p>
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
            <CardContent className="space-y-4 text-sm text-foreground/90">
              <dl className="grid grid-cols-1 gap-3 text-sm text-foreground/90">
                <div className="rounded-lg border border-border/60 bg-muted/60 p-4">
                  <dt className="text-xs uppercase tracking-wide text-muted-foreground">Current build</dt>
                  <dd className="text-base font-medium text-foreground">{updateStatus.currentVersion}</dd>
                </div>
                <div className="rounded-lg border border-border/60 bg-muted/60 p-4">
                  <dt className="text-xs uppercase tracking-wide text-muted-foreground">Latest manifest</dt>
                  <dd className="text-base font-medium text-foreground">{updateStatus.latestVersion ?? '—'}</dd>
                </div>
                <div className="rounded-lg border border-border/60 bg-muted/60 p-4">
                  <dt className="text-xs uppercase tracking-wide text-muted-foreground">Last checked</dt>
                  <dd className="text-base font-medium text-foreground">{formatTimestamp(updateStatus.checkedAt)}</dd>
                </div>
              </dl>
              <p className="text-xs text-muted-foreground">{updateStatus.message ?? 'No update checks have run yet.'}</p>
              {updateError && <p className="text-xs text-rose-600 dark:text-rose-300">{updateError}</p>}
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleUpdateCheck}
                  disabled={updateBusy}
                  className="flex-1 text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground"
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
                    'w-full rounded-md border px-4 py-2 text-center text-[0.75rem] font-semibold uppercase tracking-[0.2em] transition sm:w-auto',
                    updateStatus.autoCheckEnabled
                      ? 'border-emerald-500/70 text-emerald-700 dark:text-emerald-100'
                      : 'border-border text-muted-foreground'
                  )}
                >
                  {updateStatus.autoCheckEnabled ? 'Auto checks on' : 'Auto checks off'}
                </button>
              </div>
            </CardContent>
          </Card>
    )
  };

  return (
    <ThemeProvider defaultTheme="dark" storageKey="relay-ui-theme">
      <main className="relative flex min-h-screen bg-background font-sans text-foreground antialiased">
        <div
          aria-hidden="true"
          className="fixed left-0 right-0 top-0 z-50 h-10"
          style={{
            WebkitAppRegion: 'drag',
            WebkitUserSelect: 'none'
          }}
        />
        <aside className="flex min-h-screen w-[240px] flex-col border-r border-border/60 bg-card px-6 py-8">
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-primary/10 text-lg font-semibold text-primary">
                R
              </div>
              <div>
                <p className="text-sm font-semibold text-foreground">Relay Control</p>
                <p className="text-xs text-muted-foreground">Shared MCP shell</p>
              </div>
            </div>
            </div>
          <nav className="mt-8 flex flex-col gap-2" aria-label="Primary">
            {SIDEBAR_SECTIONS.map((section) => {
              const isActive = activeSection === section.id;
              return (
                <button
                  key={section.id}
                  type="button"
                  onClick={() => handleSectionChange(section.id)}
                  aria-current={isActive ? 'page' : undefined}
                  className={cn(
                    'group flex items-center gap-3 rounded-lg px-3 py-2 text-left text-sm font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60',
                    isActive ? 'bg-accent text-accent-foreground' : 'text-muted-foreground hover:bg-accent/50 hover:text-foreground'
                  )}
                >
                  <span className="flex h-8 w-8 items-center justify-center rounded-md bg-muted text-muted-foreground group-hover:text-foreground">
                    {section.icon}
                  </span>
                  <span>{section.label}</span>
                </button>
              );
            })}
          </nav>
        </aside>
        <div className="relative flex min-h-screen flex-1 flex-col bg-background">
          <div className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-8 px-6 py-10 lg:px-10">
            <header
              className="flex flex-col gap-6 md:flex-row md:items-start md:justify-between"
              style={{ WebkitAppRegion: 'drag' }}
            >
              <div className="space-y-3">
                <p className="text-xs font-semibold uppercase tracking-[0.3em] text-primary/80">Relay</p>
                <h1 className="text-3xl font-semibold text-foreground sm:text-4xl">Shared MCP Orchestrator</h1>
                <p className="max-w-2xl text-base text-muted-foreground">
                  Shared MCP shell keeps Cursor, Claude, and Codex servers in sync with secure Keychain storage.
                </p>
              </div>
              <div className="flex items-center gap-3">
                <ModeToggle />
                <Button
                  variant="outline"
                  className="self-start text-xs font-semibold text-muted-foreground"
                  style={{ WebkitAppRegion: 'no-drag' }}
                  type="button"
                  aria-label="Open settings panel"
                  onClick={() => handleSectionChange('settings')}
                >
                  Settings
                </Button>
              </div>
            </header>
          <div className="relative min-h-[420px]">
            {SIDEBAR_SECTIONS.map((section) => {
              const isActive = activeSection === section.id;
              return (
                <section
                  key={`section-${section.id}`}
                  data-section={section.id}
                  aria-hidden={!isActive}
                  className={cn(
                    'transition-all duration-300',
                    isActive
                      ? 'relative opacity-100'
                      : 'absolute inset-0 -z-10 pointer-events-none opacity-0'
                  )}
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
    </ThemeProvider>
  );
};

export default App;
