import type { RegistryServerEntry, DetectionSummary } from '../../../../main/src/ipc/contracts';
import type { SupportedAgent } from '../../../../main/src/types/agents';
import { ServerCard } from './ServerCard';
import { Button } from '../ui/button';

interface ServerListProps {
  servers: RegistryServerEntry[];
  detection: DetectionSummary;
  loading: boolean;
  onAddServer: () => void;
  onEditServer: (id: string) => void;
  onDeleteServer: (id: string) => void;
  onMasterToggle: (id: string, enabled: boolean) => void;
  onAppToggle: (id: string, agent: SupportedAgent) => void;
}

const PlusIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-5 h-5">
    <path d="M12 5v14M5 12h14" />
  </svg>
);

const ServerIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="w-12 h-12 text-muted-foreground/30">
    <rect x="2" y="2" width="20" height="8" rx="2" />
    <rect x="2" y="14" width="20" height="8" rx="2" />
    <circle cx="6" cy="6" r="1" fill="currentColor" />
    <circle cx="6" cy="18" r="1" fill="currentColor" />
  </svg>
);

export function ServerList({
  servers,
  detection,
  loading,
  onAddServer,
  onEditServer,
  onDeleteServer,
  onMasterToggle,
  onAppToggle,
}: ServerListProps) {
  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="flex items-center gap-3 text-muted-foreground">
          <svg className="w-5 h-5 animate-spin" viewBox="0 0 24 24" fill="none">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
          </svg>
          <span className="text-sm">Loading servers...</span>
        </div>
      </div>
    );
  }

  if (servers.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-center">
        <ServerIcon />
        <h3 className="mt-4 text-sm font-semibold text-foreground">No servers yet</h3>
        <p className="mt-1 text-xs text-muted-foreground max-w-sm">
          Add your first MCP server by pasting its configuration.
          Just copy the JSON from your provider's docs.
        </p>
        <Button onClick={onAddServer} className="mt-6">
          <PlusIcon />
          Add Server
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {servers.map((server) => (
        <ServerCard
          key={server.id}
          server={server}
          detection={detection}
          onMasterToggle={(enabled) => onMasterToggle(server.id, enabled)}
          onAppToggle={(agent) => onAppToggle(server.id, agent)}
          onEdit={() => onEditServer(server.id)}
          onDelete={() => onDeleteServer(server.id)}
        />
      ))}
    </div>
  );
}
