import * as React from 'react';
import { cn } from '../../lib/utils';

export type InputProps = React.InputHTMLAttributes<HTMLInputElement>;

const Input = React.forwardRef<HTMLInputElement, InputProps>(({ className, type = 'text', ...props }, ref) => (
  <input
    ref={ref}
    type={type}
    data-slot="input"
    className={cn(
      'flex h-10 w-full min-w-0 rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground ring-offset-background transition-colors placeholder:text-muted-foreground selection:bg-primary selection:text-primary-foreground',
      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
      'aria-invalid:ring-destructive/20 aria-invalid:border-destructive disabled:pointer-events-none disabled:opacity-50',
      className
    )}
    {...props}
  />
));
Input.displayName = 'Input';

export { Input };
