import type { RegistryServerEntry } from '../../../../main/src/ipc/contracts';
import type { SupportedAgent } from '../../../../main/src/types/agents';
import type { DetectionSummary } from '../../../../main/src/ipc/contracts';
import { cn } from '../../lib/utils';
import { TypeBadge, type ServerType } from '../shared/TypeBadge';
import { AppToggle } from '../shared/AppToggle';
import { MasterToggle } from '../shared/MasterToggle';

interface ServerCardProps {
  server: RegistryServerEntry;
  detection: DetectionSummary;
  onMasterToggle: (enabled: boolean) => void;
  onAppToggle: (agent: SupportedAgent) => void;
  onEdit: () => void;
  onDelete: () => void;
}

const AGENTS: SupportedAgent[] = ['cursor', 'claude', 'codex'];

// Determine server type from the registry entry
function getServerType(server: RegistryServerEntry): ServerType {
  // For now, all servers are command-based (URL support coming in v2)
  return 'command';
}

// Format command for display
function formatCommand(server: RegistryServerEntry): string {
  const args = server.launch.args?.length ? ` ${server.launch.args.join(' ')}` : '';
  const cmd = `${server.launch.command}${args}`;
  return cmd.length > 50 ? cmd.slice(0, 47) + '...' : cmd;
}

// Compute master toggle state
function computeMasterState(
  server: RegistryServerEntry,
  detection: DetectionSummary
): 'on' | 'off' | 'custom' {
  if (!server.enabled) return 'off';

  const detectedAgents = AGENTS.filter((agent) => detection[agent]?.detected);
  if (detectedAgents.length === 0) return 'off';

  const allOn = detectedAgents.every((agent) => server.apps?.[agent] !== false);
  const allOff = detectedAgents.every((agent) => server.apps?.[agent] === false);

  if (allOn) return 'on';
  if (allOff) return 'off';
  return 'custom';
}

export function ServerCard({
  server,
  detection,
  onMasterToggle,
  onAppToggle,
  onEdit,
  onDelete,
}: ServerCardProps) {
  const serverType = getServerType(server);
  const masterState = computeMasterState(server, detection);
  const isEnabled = masterState === 'on' || masterState === 'custom';

  return (
    <div
      className={cn(
        'group relative rounded-xl border bg-card transition-all duration-200',
        isEnabled
          ? 'border-border shadow-sm'
          : 'border-border/50 bg-card/50'
      )}
    >
      {/* Main Content */}
      <div className="p-4">
        {/* Header Row */}
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <h3
                className={cn(
                  'text-sm font-medium truncate',
                  isEnabled ? 'text-foreground' : 'text-muted-foreground'
                )}
              >
                {server.name}
              </h3>
              <TypeBadge type={serverType} />
            </div>
            <p
              className={cn(
                'text-xs font-mono truncate',
                isEnabled ? 'text-muted-foreground' : 'text-muted-foreground/60'
              )}
              title={formatCommand(server)}
            >
              {formatCommand(server)}
            </p>
          </div>

          {/* Master Toggle */}
          <div className="flex items-center gap-3">
            <MasterToggle
              checked={isEnabled}
              onCheckedChange={onMasterToggle}
              size="lg"
            />
          </div>
        </div>

        {/* App Toggles */}
        <div className="flex items-center gap-2 mt-4 pt-4 border-t border-border/50">
          <span className="text-[11px] text-muted-foreground uppercase tracking-wide mr-2">
            Apps
          </span>
          {AGENTS.map((agent) => {
            const detected = detection[agent]?.detected ?? false;
            const enabled = server.enabled && server.apps?.[agent] !== false;
            return (
              <AppToggle
                key={agent}
                app={agent}
                enabled={enabled}
                detected={detected}
                onChange={() => onAppToggle(agent)}
                disabled={!server.enabled}
                size="sm"
              />
            );
          })}
        </div>
      </div>

      {/* Actions - Show on hover */}
      <div
        className={cn(
          'absolute top-3 right-16 flex items-center gap-1',
          'opacity-0 group-hover:opacity-100 transition-opacity duration-150'
        )}
      >
        <button
          type="button"
          onClick={onEdit}
          className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
          title="Edit server"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="w-4 h-4">
            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
          </svg>
        </button>
        <button
          type="button"
          onClick={onDelete}
          className="p-1.5 rounded-md text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
          title="Delete server"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="w-4 h-4">
            <path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
          </svg>
        </button>
      </div>
    </div>
  );
}
