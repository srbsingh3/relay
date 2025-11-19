import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '../../lib/utils';

const typographyVariants = cva('', {
  variants: {
    variant: {
      h1: 'text-3xl font-bold tracking-tight',
      h2: 'text-2xl font-semibold tracking-tight',
      h3: 'text-xl font-semibold tracking-tight',
      h4: 'text-lg font-semibold tracking-tight',
      body: 'text-base',
      small: 'text-sm',
      label: 'text-xs uppercase tracking-[0.25em] font-medium',
      eyebrow: 'text-xs font-semibold uppercase tracking-[0.3em]',
    },
    color: {
      default: 'text-foreground',
      muted: 'text-muted-foreground',
      primary: 'text-primary',
      destructive: 'text-destructive',
      success: 'text-success',
      warning: 'text-warning',
    }
  },
  defaultVariants: {
    variant: 'body',
    color: 'default',
  }
});

export interface TypographyProps
  extends React.HTMLAttributes<HTMLElement>,
    VariantProps<typeof typographyVariants> {
  as?: keyof JSX.IntrinsicElements;
}

const Typography = React.forwardRef<HTMLElement, TypographyProps>(
  ({ className, variant, color, as, ...props }, ref) => {
    const Component = as ?? (
      variant === 'h1' ? 'h1' :
      variant === 'h2' ? 'h2' :
      variant === 'h3' ? 'h3' :
      variant === 'h4' ? 'h4' :
      variant === 'label' || variant === 'eyebrow' ? 'div' :
      'p'
    );

    return (
      <Component
        className={cn(typographyVariants({ variant, color, className }))}
        ref={ref}
        {...props}
      />
    );
  }
);
Typography.displayName = 'Typography';

export { Typography, typographyVariants };