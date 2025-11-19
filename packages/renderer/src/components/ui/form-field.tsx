import * as React from 'react';
import { Label } from './label';
import { Typography } from './typography';
import { cn } from '../../lib/utils';

interface FormFieldProps {
  label?: string;
  description?: string;
  error?: string;
  required?: boolean;
  children: React.ReactNode;
  className?: string;
}

const FormField = React.forwardRef<HTMLDivElement, FormFieldProps>(
  ({ label, description, error, required, children, className }, ref) => {
    const id = React.useId();

    return (
      <div ref={ref} className={cn('space-y-2', className)}>
        {label && (
          <Label htmlFor={id} className={cn(required && "after:content-[' *'] after:text-destructive")}>
            {label}
          </Label>
        )}
        {React.cloneElement(children as React.ReactElement, {
          id,
          'aria-invalid': error ? 'true' : 'undefined',
          'aria-describedby': error ? `${id}-error` : description ? `${id}-description` : undefined
        })}
        {description && !error && (
          <Typography variant="small" color="muted" id={`${id}-description`}>
            {description}
          </Typography>
        )}
        {error && (
          <Typography variant="small" color="destructive" id={`${id}-error`} role="alert">
            {error}
          </Typography>
        )}
      </div>
    );
  }
);
FormField.displayName = 'FormField';

export { FormField };