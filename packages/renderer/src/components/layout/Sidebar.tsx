import { cn } from '../../lib/utils';
import { useTheme } from '../theme-provider';

export type ViewId = 'servers' | 'settings';

interface SidebarProps {
  activeView: ViewId;
  onViewChange: (view: ViewId) => void;
  serverCount: number;
  detectedCount: number;
}

const ServerIcon = () => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={1.5}
    className="w-5 h-5"
  >
    <rect x="3" y="4" width="18" height="6" rx="1.5" />
    <rect x="3" y="14" width="18" height="6" rx="1.5" />
    <circle cx="7" cy="7" r="1" fill="currentColor" />
    <circle cx="7" cy="17" r="1" fill="currentColor" />
  </svg>
);

const SettingsIcon = () => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={1.5}
    className="w-5 h-5"
  >
    <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
    <circle cx="12" cy="12" r="3" />
  </svg>
);

const MoonIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="w-4 h-4">
    <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
  </svg>
);

const SunIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="w-4 h-4">
    <circle cx="12" cy="12" r="4" />
    <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41" />
  </svg>
);

const MonitorIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="w-4 h-4">
    <rect x="2" y="3" width="20" height="14" rx="2" />
    <path d="M8 21h8M12 17v4" />
  </svg>
);

export function Sidebar({
  activeView,
  onViewChange,
  serverCount,
  detectedCount,
}: SidebarProps) {
  const { theme, setTheme } = useTheme();

  const navItems = [
    {
      id: 'servers' as const,
      label: 'Servers',
      icon: <ServerIcon />,
      badge: serverCount > 0 ? serverCount.toString() : undefined,
    },
    {
      id: 'settings' as const,
      label: 'Settings',
      icon: <SettingsIcon />,
      badge: detectedCount > 0 ? detectedCount.toString() : undefined,
    },
  ];

  const themeOptions = [
    { value: 'light' as const, icon: <SunIcon />, label: 'Light' },
    { value: 'dark' as const, icon: <MoonIcon />, label: 'Dark' },
    { value: 'system' as const, icon: <MonitorIcon />, label: 'System' },
  ];

  return (
    <aside className="flex flex-col w-56 h-full bg-sidebar border-r border-sidebar-border">
      {/* Logo */}
      <div className="flex items-center gap-3 px-5 py-5">
        <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-foreground text-background font-semibold text-sm">
          R
        </div>
        <div>
          <h1 className="text-sm font-semibold text-foreground">Relay</h1>
          <p className="text-xs text-muted-foreground/70">MCP Manager</p>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-2">
        <ul className="space-y-1">
          {navItems.map((item) => (
            <li key={item.id}>
              <button
                type="button"
                onClick={() => onViewChange(item.id)}
                className={cn(
                  'flex items-center gap-3 w-full px-3 py-2 rounded-lg text-sm font-medium transition-colors duration-150',
                  activeView === item.id
                    ? 'bg-sidebar-accent text-foreground'
                    : 'text-muted-foreground hover:text-foreground hover:bg-sidebar-accent/50'
                )}
              >
                <span className={cn(
                  activeView === item.id ? 'text-foreground' : 'text-muted-foreground'
                )}>
                  {item.icon}
                </span>
                <span className="flex-1 text-left">{item.label}</span>
                {item.badge && (
                  <span className="text-xs text-muted-foreground tabular-nums">
                    {item.badge}
                  </span>
                )}
              </button>
            </li>
          ))}
        </ul>
      </nav>

      {/* Theme Switcher */}
      <div className="px-3 py-4 border-t border-sidebar-border">
        <div className="flex items-center gap-1 p-1 rounded-lg bg-sidebar-accent/50">
          {themeOptions.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => setTheme(option.value)}
              className={cn(
                'flex-1 flex items-center justify-center gap-1.5 px-2 py-1.5 rounded-md text-xs font-medium transition-all duration-150',
                theme === option.value
                  ? 'bg-background text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              )}
              title={option.label}
            >
              {option.icon}
            </button>
          ))}
        </div>
      </div>
    </aside>
  );
}
