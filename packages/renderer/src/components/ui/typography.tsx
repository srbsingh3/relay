import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '../../lib/utils';

const typographyVariants = cva('', {
  variants: {
    variant: {
      // Minimal 4-size scale: lg (18px), base (16px), sm (14px), xs (12px)
      // Use weight, color, and space for hierarchy instead of more sizes
      h1: 'text-lg font-semibold tracking-tight',
      h2: 'text-base font-semibold',
      h3: 'text-sm font-semibold',
      h4: 'text-sm font-medium',
      body: 'text-sm',
      small: 'text-xs',
      label: 'text-xs uppercase tracking-wide font-medium',
      caption: 'text-xs',
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
  extends Omit<React.HTMLAttributes<HTMLElement>, 'color'>,
  VariantProps<typeof typographyVariants> {
  as?: React.ElementType;
}

const Typography = React.forwardRef<HTMLElement, TypographyProps>(
  ({ className, variant, color, as, ...props }, ref) => {
    const Component = as ?? (
      variant === 'h1' ? 'h1' :
        variant === 'h2' ? 'h2' :
          variant === 'h3' ? 'h3' :
            variant === 'h4' ? 'h4' :
              variant === 'label' || variant === 'caption' ? 'div' :
                'p'
    ) as React.ElementType;

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