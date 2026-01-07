import { cn } from '../../lib/utils';

export type AppName = 'cursor' | 'claude' | 'codex';

interface AppToggleProps {
  app: AppName;
  enabled: boolean;
  detected: boolean;
  onChange: () => void;
  disabled?: boolean;
  size?: 'sm' | 'default';
}

const appLabels: Record<AppName, string> = {
  cursor: 'Cursor',
  claude: 'Claude',
  codex: 'Codex',
};

const appIcons: Record<AppName, React.ReactNode> = {
  cursor: (
    <svg viewBox="0 0 24 24" fill="currentColor" className="w-3 h-3">
      <path d="M5.5 3L19 12l-13.5 9V3z" />
    </svg>
  ),
  claude: (
    <svg viewBox="0 0 24 24" fill="currentColor" className="w-3 h-3">
      <circle cx="12" cy="12" r="8" />
    </svg>
  ),
  codex: (
    <svg viewBox="0 0 24 24" fill="currentColor" className="w-3 h-3">
      <rect x="4" y="4" width="16" height="16" rx="2" />
    </svg>
  ),
};

export function AppToggle({
  app,
  enabled,
  detected,
  onChange,
  disabled,
  size = 'default',
}: AppToggleProps) {
  const isDisabled = disabled || !detected;

  return (
    <button
      type="button"
      onClick={onChange}
      disabled={isDisabled}
      className={cn(
        'inline-flex items-center gap-1.5 rounded-md border font-medium transition-all duration-150 text-xs',
        size === 'sm' ? 'px-2 py-1' : 'px-2.5 py-1.5',
        isDisabled && 'opacity-40 cursor-not-allowed',
        !isDisabled && 'hover:border-border/80',
        enabled && detected
          ? 'bg-foreground/5 border-foreground/20 text-foreground'
          : 'bg-transparent border-border text-muted-foreground'
      )}
      title={!detected ? `${appLabels[app]} not detected` : undefined}
    >
      <span
        className={cn(
          'flex items-center justify-center',
          enabled && detected ? 'text-foreground' : 'text-muted-foreground/60'
        )}
      >
        {appIcons[app]}
      </span>
      <span>{appLabels[app]}</span>
      {!detected && (
        <span className="text-muted-foreground/50">(N/A)</span>
      )}
    </button>
  );
}
