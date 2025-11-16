import * as React from 'react';
import { cn } from '../../lib/utils';

export type TextareaProps = React.TextareaHTMLAttributes<HTMLTextAreaElement>;

const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(({ className, ...props }, ref) => (
  <textarea
    ref={ref}
    data-slot="textarea"
    className={cn(
      'flex field-sizing-content min-h-24 w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground ring-offset-background transition-colors placeholder:text-muted-foreground selection:bg-primary selection:text-primary-foreground',
      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
      'aria-invalid:ring-destructive/20 aria-invalid:border-destructive disabled:pointer-events-none disabled:opacity-50',
      className
    )}
    {...props}
  />
));
Textarea.displayName = 'Textarea';

export { Textarea };
