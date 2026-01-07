import { useCallback, useEffect, useMemo, useState } from 'react';
import type {
  DetectionStatus,
  DetectionSummary,
  RegistryServerEntry,
  RegistrySnapshot,
  SyncStatusSnapshot,
  UpdateStatusSnapshot,
} from '../../main/src/ipc/contracts';
import { REGISTRY_VERSION } from '../../main/src/registry/schema';
import type { SupportedAgent } from '../../main/src/types/agents';
import { SUPPORTED_AGENTS } from '../../main/src/types/agents';

// Components
import { Sidebar, type ViewId } from './components/layout/Sidebar';
import { ServerList } from './components/servers/ServerList';
import { AddServerFlow } from './components/servers/AddServerFlow';
import { SettingsView } from './components/settings/SettingsView';
import { Button } from './components/ui/button';

// Types
type ModalState = { mode: 'add' } | { mode: 'edit'; serverId: string } | null;

// Helpers
const buildDetectionSnapshot = (
  overrides?: Partial<Record<SupportedAgent, Partial<DetectionStatus>>>
): DetectionSummary => {
  const timestamp = new Date().toISOString();
  return SUPPORTED_AGENTS.reduce<DetectionSummary>((acc, agent) => {
    const override = overrides?.[agent];
    acc[agent] = {
      detected: override?.detected ?? false,
      path: override?.path ?? null,
      lastChecked: override?.lastChecked ?? timestamp,
    };
    return acc;
  }, {} as DetectionSummary);
};

const fallbackServers: RegistryServerEntry[] = [
  {
    id: 'srv_context7',
    name: 'Context7',
    enabled: true,
    launch: {
      mode: 'command',
      command: 'npx',
      args: ['-y', '@upstash/context7-mcp'],
    },
    env: {
      CONTEXT7_API_KEY: 'keychain:context7_key',
    },
    apps: {},
  },
  {
    id: 'srv_filesystem',
    name: 'Filesystem',
    enabled: true,
    launch: {
      mode: 'command',
      command: 'npx',
      args: ['-y', '@modelcontextprotocol/server-filesystem', '/Users'],
    },
    env: {},
    apps: { codex: false },
  },
];

const fallbackDetection = buildDetectionSnapshot({
  cursor: { detected: true, path: '~/.cursor/mcp.json' },
  claude: { detected: true, path: '~/.claude.json' },
  codex: { detected: false },
});

const fallbackRegistrySnapshot: RegistrySnapshot = {
  version: REGISTRY_VERSION,
  servers: fallbackServers,
};

const buildFallbackSyncStatus = (): SyncStatusSnapshot => ({
  state: 'idle',
  lastRun: new Date(Date.now() - 1000 * 60 * 30).toISOString(),
});

const buildFallbackUpdateStatus = (version: string): UpdateStatusSnapshot => ({
  state: 'up_to_date',
  currentVersion: version,
  latestVersion: version,
  checkedAt: new Date().toISOString(),
  message: 'Preview mode: updates are mocked.',
  autoCheckEnabled: true,
});

const SERVER_ID_PREFIX = 'srv_';

const slugifyServerName = (input: string): string =>
  input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/_{2,}/g, '_')
    .replace(/^_+|_+$/g, '');

const generateServerId = (name: string, existing: RegistryServerEntry[]): string => {
  const used = new Set(existing.map((s) => s.id));
  const slug = slugifyServerName(name) || 'server';
  let candidate = `${SERVER_ID_PREFIX}${slug}`;
  let counter = 2;
  while (used.has(candidate)) {
    candidate = `${SERVER_ID_PREFIX}${slug}_${counter}`;
    counter += 1;
  }
  return candidate;
};

const normalizeAppOverrides = (
  overrides?: RegistryServerEntry['apps']
): RegistryServerEntry['apps'] | undefined => {
  if (!overrides) return undefined;
  const entries = Object.entries(overrides).filter(([, value]) => value === false);
  if (entries.length === 0) return undefined;
  return entries.reduce<RegistryServerEntry['apps']>((acc, [key]) => {
    if (!acc) acc = {};
    acc[key as SupportedAgent] = false;
    return acc;
  }, {} as RegistryServerEntry['apps']);
};

const resolveBridge = () => (typeof window !== 'undefined' ? window.relay : undefined);

// Icons
const PlusIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-4 h-4">
    <path d="M12 5v14M5 12h14" />
  </svg>
);

export default function App() {
  const bridge = resolveBridge();
  const versionLabel = typeof window !== 'undefined' ? window.relay?.version ?? '0.1.0-dev' : '0.1.0-dev';

  // State
  const [activeView, setActiveView] = useState<ViewId>('servers');
  const [servers, setServers] = useState<RegistryServerEntry[]>(() =>
    bridge ? [] : fallbackRegistrySnapshot.servers
  );
  const [registryVersion, setRegistryVersion] = useState<number>(() =>
    bridge ? REGISTRY_VERSION : fallbackRegistrySnapshot.version
  );
  const [detection, setDetection] = useState<DetectionSummary>(() =>
    bridge ? buildDetectionSnapshot() : fallbackDetection
  );
  const [syncStatus, setSyncStatus] = useState<SyncStatusSnapshot>(() =>
    bridge ? { state: 'idle', lastRun: null } : buildFallbackSyncStatus()
  );
  const [updateStatus, setUpdateStatus] = useState<UpdateStatusSnapshot>(() =>
    buildFallbackUpdateStatus(versionLabel)
  );
  const [modalState, setModalState] = useState<ModalState>(null);

  // Loading states
  const [loading, setLoading] = useState(Boolean(bridge));
  const [syncBusy, setSyncBusy] = useState(false);
  const [updateBusy, setUpdateBusy] = useState(false);
  const [detectionBusy, setDetectionBusy] = useState(false);

  // Errors
  const [loadError, setLoadError] = useState<string | null>(null);

  // Computed
  const detectedCount = useMemo(
    () => SUPPORTED_AGENTS.filter((a) => detection[a]?.detected).length,
    [detection]
  );

  // Initial hydration
  useEffect(() => {
    if (!bridge) return;

    let cancelled = false;

    const hydrate = async () => {
      setLoading(true);
      try {
        const [registrySnapshot, detectionSnapshot, syncSnapshot, updateSnapshot] =
          await Promise.all([
            bridge.registry.read(),
            bridge.detection.status(),
            bridge.sync.status(),
            bridge.updates.status(),
          ]);

        if (cancelled) return;

        setServers(registrySnapshot.servers);
        setRegistryVersion(registrySnapshot.version);
        setDetection(detectionSnapshot);
        setSyncStatus(syncSnapshot);
        setUpdateStatus(updateSnapshot);
        setLoadError(null);
      } catch (error) {
        console.error('[relay] hydration failed', error);
        if (!cancelled) {
          setLoadError('Unable to load data from main process');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    hydrate();
    return () => {
      cancelled = true;
    };
  }, [bridge]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && modalState) {
        setModalState(null);
      }
      if ((e.metaKey || e.ctrlKey) && e.key === 'k' && !modalState) {
        e.preventDefault();
        setModalState({ mode: 'add' });
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [modalState]);

  // Persist servers
  const persistServers = useCallback(
    async (nextServers: RegistryServerEntry[]): Promise<boolean> => {
      if (!bridge) return true;
      try {
        const snapshot = await bridge.registry.write({
          snapshot: { version: registryVersion, servers: nextServers },
        });
        setServers(snapshot.servers);
        setRegistryVersion(snapshot.version);
        return true;
      } catch (error) {
        console.error('[relay] persist failed', error);
        return false;
      }
    },
    [bridge, registryVersion]
  );

  // Handlers
  const handleAddServer = useCallback(
    async (
      parsed: {
        name: string;
        type: 'command' | 'url';
        command?: string;
        args?: string[];
        url?: string;
        headers?: Record<string, string>;
        env?: Record<string, string>;
        placeholders: { key: string; location: string }[];
      },
      secrets: Record<string, string>
    ) => {
      // Store secrets in keychain
      if (bridge) {
        for (const [alias, value] of Object.entries(secrets)) {
          if (value) {
            await bridge.keychain.save({ alias, secret: value });
          }
        }
      }

      // Build env with keychain references
      const env: Record<string, string> = {};
      if (parsed.env) {
        Object.entries(parsed.env).forEach(([key, value]) => {
          const placeholder = parsed.placeholders.find((p) => p.key === key);
          if (placeholder && secrets[key]) {
            env[key] = `keychain:${key.toLowerCase()}`;
          } else {
            env[key] = value;
          }
        });
      }
      parsed.placeholders.forEach((p) => {
        if (secrets[p.key] && !env[p.key]) {
          env[p.key] = `keychain:${p.key.toLowerCase()}`;
        }
      });

      const newServer: RegistryServerEntry = {
        id: generateServerId(parsed.name, servers),
        name: parsed.name,
        enabled: true,
        launch: {
          mode: 'command',
          command: parsed.command ?? 'npx',
          args: parsed.args ?? [],
        },
        env,
        apps: {},
      };

      const nextServers = [...servers, newServer];
      setServers(nextServers);
      await persistServers(nextServers);
      setModalState(null);
    },
    [bridge, servers, persistServers]
  );

  const handleMasterToggle = useCallback(
    (serverId: string, enabled: boolean) => {
      const nextServers = servers.map((s) => {
        if (s.id !== serverId) return s;
        if (enabled) {
          // Enable for all detected apps
          const apps = { ...(s.apps ?? {}) };
          SUPPORTED_AGENTS.forEach((agent) => {
            if (detection[agent]?.detected) {
              delete apps[agent];
            }
          });
          return { ...s, apps: normalizeAppOverrides(apps) };
        } else {
          // Disable for all apps
          const apps: Record<SupportedAgent, boolean> = {} as any;
          SUPPORTED_AGENTS.forEach((agent) => {
            apps[agent] = false;
          });
          return { ...s, apps };
        }
      });
      setServers(nextServers);
      void persistServers(nextServers);
    },
    [servers, detection, persistServers]
  );

  const handleAppToggle = useCallback(
    (serverId: string, agent: SupportedAgent) => {
      if (!detection[agent]?.detected) return;

      const nextServers = servers.map((s) => {
        if (s.id !== serverId) return s;
        const apps = { ...(s.apps ?? {}) };
        if (apps[agent] === false) {
          delete apps[agent];
        } else {
          apps[agent] = false;
        }
        return { ...s, apps: normalizeAppOverrides(apps) };
      });
      setServers(nextServers);
      void persistServers(nextServers);
    },
    [servers, detection, persistServers]
  );

  const handleDeleteServer = useCallback(
    async (serverId: string) => {
      const target = servers.find((s) => s.id === serverId);
      if (!target) return;

      const confirmed = window.confirm(`Delete "${target.name}"? This cannot be undone.`);
      if (!confirmed) return;

      const nextServers = servers.filter((s) => s.id !== serverId);
      setServers(nextServers);
      await persistServers(nextServers);
    },
    [servers, persistServers]
  );

  const handleSync = useCallback(async () => {
    if (syncBusy) return;
    setSyncBusy(true);
    setSyncStatus((prev) => ({ ...prev, state: 'running' }));

    try {
      if (!bridge) {
        await new Promise((r) => setTimeout(r, 500));
        setSyncStatus({ state: 'idle', lastRun: new Date().toISOString() });
        return;
      }

      const result = await bridge.sync.invoke({ source: 'user' });
      setSyncStatus({
        state: result.ok ? 'idle' : 'error',
        lastRun: result.finishedAt,
        lastError: result.ok ? undefined : result.message,
      });
    } catch (error) {
      setSyncStatus((prev) => ({
        ...prev,
        state: 'error',
        lastError: 'Sync failed',
      }));
    } finally {
      setSyncBusy(false);
    }
  }, [bridge, syncBusy]);

  const handleCheckUpdate = useCallback(async () => {
    if (updateBusy) return;
    setUpdateBusy(true);
    setUpdateStatus((prev) => ({ ...prev, state: 'checking' }));

    try {
      if (!bridge) {
        await new Promise((r) => setTimeout(r, 500));
        setUpdateStatus((prev) => ({
          ...prev,
          state: 'up_to_date',
          checkedAt: new Date().toISOString(),
        }));
        return;
      }

      const snapshot = await bridge.updates.check({ source: 'manual' });
      setUpdateStatus(snapshot);
    } catch {
      setUpdateStatus((prev) => ({
        ...prev,
        state: 'error',
        message: 'Failed to check for updates',
      }));
    } finally {
      setUpdateBusy(false);
    }
  }, [bridge, updateBusy]);

  const handleToggleAutoUpdate = useCallback(async () => {
    const next = !updateStatus.autoCheckEnabled;
    try {
      if (!bridge) {
        setUpdateStatus((prev) => ({ ...prev, autoCheckEnabled: next }));
        return;
      }
      const snapshot = await bridge.updates.preference({ autoCheckEnabled: next });
      setUpdateStatus(snapshot);
    } catch {
      console.error('Failed to toggle auto-update');
    }
  }, [bridge, updateStatus.autoCheckEnabled]);

  const handleRefreshDetection = useCallback(async () => {
    if (!bridge || detectionBusy) return;
    setDetectionBusy(true);
    try {
      const snapshot = await bridge.detection.refresh();
      setDetection(snapshot);
    } catch {
      console.error('Failed to refresh detection');
    } finally {
      setDetectionBusy(false);
    }
  }, [bridge, detectionBusy]);

  return (
    <div className="flex h-screen bg-background text-foreground overflow-hidden">
      {/* Sidebar */}
      <Sidebar
        activeView={activeView}
        onViewChange={setActiveView}
        serverCount={servers.length}
        detectedCount={detectedCount}
      />

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Header */}
        <header className="flex items-center justify-between px-8 py-5 border-b border-border bg-background/80 backdrop-blur-sm">
          <div>
            <h1 className="text-xl font-semibold text-foreground">
              {activeView === 'servers' ? 'MCP Servers' : 'Settings'}
            </h1>
            <p className="text-sm text-muted-foreground">
              {activeView === 'servers'
                ? `${servers.length} server${servers.length !== 1 ? 's' : ''} configured`
                : `${detectedCount} of 3 apps detected`}
            </p>
          </div>

          {activeView === 'servers' && (
            <Button onClick={() => setModalState({ mode: 'add' })}>
              <PlusIcon />
              Add Server
            </Button>
          )}
        </header>

        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          <div className="max-w-3xl mx-auto px-8 py-6">
            {loadError && (
              <div className="mb-6 p-4 rounded-xl bg-destructive/10 border border-destructive/20 text-destructive text-sm">
                {loadError}
              </div>
            )}

            {activeView === 'servers' && (
              <ServerList
                servers={servers}
                detection={detection}
                loading={loading}
                onAddServer={() => setModalState({ mode: 'add' })}
                onEditServer={(id) => setModalState({ mode: 'edit', serverId: id })}
                onDeleteServer={handleDeleteServer}
                onMasterToggle={handleMasterToggle}
                onAppToggle={handleAppToggle}
              />
            )}

            {activeView === 'settings' && (
              <SettingsView
                detection={detection}
                syncStatus={syncStatus}
                updateStatus={updateStatus}
                onSync={handleSync}
                onCheckUpdate={handleCheckUpdate}
                onToggleAutoUpdate={handleToggleAutoUpdate}
                onRefreshDetection={handleRefreshDetection}
                syncBusy={syncBusy}
                updateBusy={updateBusy}
                detectionBusy={detectionBusy}
              />
            )}
          </div>
        </div>
      </main>

      {/* Add Server Modal */}
      {modalState?.mode === 'add' && (
        <AddServerFlow
          onComplete={handleAddServer}
          onCancel={() => setModalState(null)}
        />
      )}
    </div>
  );
}
