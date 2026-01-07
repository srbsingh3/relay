import type {
  DetectionSummary,
  SyncStatusSnapshot,
  UpdateStatusSnapshot,
} from '../../../../main/src/ipc/contracts';
import type { SupportedAgent } from '../../../../main/src/types/agents';
import { cn } from '../../lib/utils';
import { Button } from '../ui/button';
import { MasterToggle } from '../shared/MasterToggle';

interface SettingsViewProps {
  detection: DetectionSummary;
  syncStatus: SyncStatusSnapshot;
  updateStatus: UpdateStatusSnapshot;
  onSync: () => void;
  onCheckUpdate: () => void;
  onToggleAutoUpdate: () => void;
  onRefreshDetection: () => void;
  syncBusy: boolean;
  updateBusy: boolean;
  detectionBusy: boolean;
}

const AGENTS: SupportedAgent[] = ['cursor', 'claude', 'codex'];

const agentLabels: Record<SupportedAgent, string> = {
  cursor: 'Cursor',
  claude: 'Claude Code',
  codex: 'Codex',
};

const agentDescriptions: Record<SupportedAgent, string> = {
  cursor: 'AI-powered code editor',
  claude: 'Anthropic CLI assistant',
  codex: 'OpenAI coding assistant',
};

function formatTimestamp(isoValue?: string | null): string {
  if (!isoValue) return 'Never';
  const value = new Date(isoValue);
  if (Number.isNaN(value.getTime())) return 'Never';
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(value);
}

const CheckIcon = () => (
  <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4">
    <path d="M12 22C6.477 22 2 17.523 2 12S6.477 2 12 2s10 4.477 10 10-4.477 10-10 10zm-.997-6l7.07-7.071-1.414-1.414-5.656 5.657-2.829-2.829-1.414 1.414L11.003 16z" />
  </svg>
);

const XIcon = () => (
  <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4">
    <path d="M12 22C6.477 22 2 17.523 2 12S6.477 2 12 2s10 4.477 10 10-4.477 10-10 10zm0-2a8 8 0 1 0 0-16 8 8 0 0 0 0 16zm0-9.414l2.828-2.829 1.415 1.415L13.414 12l2.829 2.828-1.415 1.415L12 13.414l-2.828 2.829-1.415-1.415L10.586 12 7.757 9.172l1.415-1.415L12 10.586z" />
  </svg>
);

const RefreshIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-4 h-4">
    <path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
    <path d="M3 3v5h5" />
    <path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16" />
    <path d="M16 21h5v-5" />
  </svg>
);

const SyncIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-4 h-4">
    <path d="M7 11a5 5 0 0 1 8.5-3.5M17 13a5 5 0 0 1-8.5 3.5" />
  </svg>
);

export function SettingsView({
  detection,
  syncStatus,
  updateStatus,
  onSync,
  onCheckUpdate,
  onToggleAutoUpdate,
  onRefreshDetection,
  syncBusy,
  updateBusy,
  detectionBusy,
}: SettingsViewProps) {
  const detectedCount = AGENTS.filter((a) => detection[a]?.detected).length;

  return (
    <div className="space-y-8">
      {/* Detected Agents */}
      <section>
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-sm font-semibold text-foreground">Detected Agents</h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              {detectedCount} of 3 supported apps detected on this machine
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={onRefreshDetection}
            disabled={detectionBusy}
          >
            <RefreshIcon />
            {detectionBusy ? 'Scanning...' : 'Refresh'}
          </Button>
        </div>

        <div className="grid gap-3">
          {AGENTS.map((agent) => {
            const status = detection[agent];
            const detected = status?.detected ?? false;
            return (
              <div
                key={agent}
                className={cn(
                  'flex items-center justify-between p-4 rounded-xl border',
                  detected
                    ? 'bg-card border-border'
                    : 'bg-muted/30 border-border/50'
                )}
              >
                <div className="flex items-center gap-4">
                  <div
                    className={cn(
                      'w-10 h-10 rounded-lg flex items-center justify-center',
                      detected
                        ? 'bg-success/10 text-success'
                        : 'bg-muted text-muted-foreground/50'
                    )}
                  >
                    {detected ? <CheckIcon /> : <XIcon />}
                  </div>
                  <div>
                    <h3
                      className={cn(
                        'text-sm font-medium',
                        detected ? 'text-foreground' : 'text-muted-foreground'
                      )}
                    >
                      {agentLabels[agent]}
                    </h3>
                    <p className="text-xs text-muted-foreground">
                      {agentDescriptions[agent]}
                    </p>
                  </div>
                </div>

                <div className="text-right">
                  <p
                    className={cn(
                      'text-xs font-medium',
                      detected ? 'text-success' : 'text-muted-foreground'
                    )}
                  >
                    {detected ? 'Detected' : 'Not Found'}
                  </p>
                  {detected && status?.path && (
                    <p
                      className="text-xs text-muted-foreground/60 font-mono truncate max-w-[200px] mt-0.5"
                      title={status.path}
                    >
                      {status.path}
                    </p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Sync Status */}
      <section>
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-sm font-semibold text-foreground">Sync Status</h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              Sync your server configs to all detected apps
            </p>
          </div>
        </div>

        <div className="p-4 rounded-xl border border-border bg-card">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-muted-foreground">Last synced</p>
              <p className="text-sm font-medium text-foreground mt-0.5">
                {formatTimestamp(syncStatus.lastRun)}
              </p>
              {syncStatus.lastError && (
                <p className="text-xs text-destructive mt-1">
                  {syncStatus.lastError}
                </p>
              )}
            </div>
            <Button
              onClick={onSync}
              disabled={syncBusy || syncStatus.state === 'running'}
            >
              <SyncIcon />
              {syncStatus.state === 'running' ? 'Syncing...' : 'Sync Now'}
            </Button>
          </div>
        </div>
      </section>

      {/* Updates */}
      <section>
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-sm font-semibold text-foreground">Updates</h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              Check for new versions of Relay
            </p>
          </div>
        </div>

        <div className="p-4 rounded-xl border border-border bg-card space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-muted-foreground">Current version</p>
              <p className="text-sm font-medium font-mono text-foreground mt-0.5">
                {updateStatus.currentVersion}
              </p>
            </div>
            <div className="text-right">
              <p className="text-xs text-muted-foreground">Latest</p>
              <p className="text-sm font-medium font-mono text-foreground mt-0.5">
                {updateStatus.latestVersion ?? '—'}
              </p>
            </div>
          </div>

          {updateStatus.message && (
            <p className="text-xs text-muted-foreground">
              {updateStatus.message}
            </p>
          )}

          <div className="flex items-center justify-between pt-4 border-t border-border">
            <div className="flex items-center gap-3">
              <MasterToggle
                checked={updateStatus.autoCheckEnabled}
                onCheckedChange={onToggleAutoUpdate}
                disabled={updateBusy}
              />
              <span className="text-xs text-muted-foreground">
                Auto-check for updates
              </span>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={onCheckUpdate}
              disabled={updateBusy || updateStatus.state === 'checking'}
            >
              {updateStatus.state === 'checking' ? 'Checking...' : 'Check Now'}
            </Button>
          </div>

          {updateStatus.checkedAt && (
            <p className="text-xs text-muted-foreground">
              Last checked: {formatTimestamp(updateStatus.checkedAt)}
            </p>
          )}
        </div>
      </section>
    </div>
  );
}
