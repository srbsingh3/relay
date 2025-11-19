// UI Components Index
//
// This file exports all shadcn/ui components and provides TypeScript documentation
// for the custom components created for Relay.

export { Alert, AlertDescription, AlertTitle } from './alert';
export type { AlertProps } from './alert';

export { Badge } from './badge';
export type { BadgeProps } from './badge';

export { Button } from './button';
export type { ButtonProps } from './button';

export { Card, CardContent, CardDescription, CardHeader, CardTitle } from './card';
export type { CardProps, CardContentProps, CardDescriptionProps, CardHeaderProps, CardTitleProps } from './card';

export { ErrorBoundary } from './error-boundary';
export type { ErrorBoundaryProps } from './error-boundary';

export { FocusTrap } from './focus-trap';
export type { FocusTrapProps } from './focus-trap';

export { FormField } from './form-field';
export type { FormFieldProps } from './form-field';

export { Input } from './input';
export type { InputProps } from './input';

export { Label } from './label';
export type { LabelProps } from './label';

export { LoadingSpinner } from './loading-spinner';
export type { LoadingSpinnerProps } from './loading-spinner';

export { Progress } from './progress';
export type { ProgressProps } from './progress';

export { Separator } from './separator';
export type { SeparatorProps } from './separator';

export { Skeleton } from './skeleton';
export type { SkeletonProps } from './skeleton';

export { StatusCard } from './status-card';
export type { StatusCardProps } from './status-card';

export { Switch } from './switch';
export type { SwitchProps } from './switch';

export { Textarea } from './textarea';
export type { TextareaProps } from './textarea';

export { Typography } from './typography';
export type { TypographyProps } from './typography';

// Re-export shadcn/ui types that don't have custom implementations
export type { VariantProps } from 'class-variance-authority';