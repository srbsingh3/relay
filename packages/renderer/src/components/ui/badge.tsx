import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '../../lib/utils';

const badgeVariants = cva(
  'inline-flex items-center justify-center rounded-md border px-2.5 py-0.5 text-xs font-semibold w-fit whitespace-nowrap shrink-0 gap-1 transition-colors ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 aria-invalid:ring-destructive/20 aria-invalid:border-destructive overflow-hidden',
  {
    variants: {
      variant: {
        default: 'border-transparent bg-primary text-primary-foreground',
        secondary: 'border-transparent bg-secondary text-secondary-foreground',
        destructive:
          'border-transparent bg-destructive/80 text-destructive-foreground focus-visible:ring-destructive/20 dark:focus-visible:ring-destructive/40',
        outline: 'border-input/70 text-foreground',
        accent: 'border-transparent bg-accent text-accent-foreground',
        success: 'border-success/60 bg-success/10 text-success dark:text-success focus-visible:ring-success/20 dark:focus-visible:ring-success/40',
        warning: 'border-warning/60 bg-warning/10 text-warning dark:text-warning focus-visible:ring-warning/20 dark:focus-visible:ring-warning/40',
        error: 'border-destructive/60 bg-destructive/10 text-destructive dark:text-destructive focus-visible:ring-destructive/20 dark:focus-visible:ring-destructive/40',
        muted: 'border-border bg-muted text-muted-foreground'
      }
    },
    defaultVariants: {
      variant: 'default'
    }
  }
);

export interface BadgeProps extends React.HTMLAttributes<HTMLDivElement>, VariantProps<typeof badgeVariants> {}

const Badge = React.forwardRef<HTMLDivElement, BadgeProps>(({ className, variant, ...props }, ref) => (
  <div ref={ref} data-slot="badge" className={cn(badgeVariants({ variant }), className)} {...props} />
));
Badge.displayName = 'Badge';

export { Badge, badgeVariants };
