import { cn } from '../../lib/utils';

export type ServerType = 'command' | 'url';

interface TypeBadgeProps {
  type: ServerType;
  className?: string;
}

export function TypeBadge({ type, className }: TypeBadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center px-1.5 py-0.5 text-xs font-medium uppercase tracking-wide rounded',
        type === 'url'
          ? 'bg-blue-500/10 text-blue-600 dark:bg-blue-500/20 dark:text-blue-400'
          : 'bg-emerald-500/10 text-emerald-600 dark:bg-emerald-500/20 dark:text-emerald-400',
        className
      )}
    >
      {type}
    </span>
  );
}
