import * as React from 'react';
import { Badge } from './badge';
import { Card, CardContent, CardHeader } from './card';
import { Typography } from './ typography';
import { cn } from '../../lib/utils';

interface StatusCardProps {
  title: string;
  description?: string;
  status: 'idle' | 'loading' | 'success' | 'warning' | 'error';
  children?: React.ReactNode;
  className?: string;
  actions?: React.ReactNode;
}

const statusBadgeVariant = {
  idle: 'muted',
  loading: 'warning',
  success: 'success',
  warning: 'warning',
  error: 'error'
} as const;

const statusLabels = {
  idle: 'Idle',
  loading: 'Loading...',
  success: 'Ready',
  warning: 'Warning',
  error: 'Error'
} as const;

const StatusCard = React.forwardRef<HTMLDivElement, StatusCardProps>(
  ({ title, description, status, children, className, actions }, ref) => {
    return (
      <Card ref={ref} className={cn('relative', className)}>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
          <div className="space-y-1">
            <Typography variant="h4">{title}</Typography>
            {description && (
              <Typography variant="small" color="muted">
                {description}
              </Typography>
            )}
          </div>
          <Badge variant={statusBadgeVariant[status]} className="text-xs">
            {statusLabels[status]}
          </Badge>
        </CardHeader>
        {children && <CardContent>{children}</CardContent>}
        {actions && (
          <div className="px-6 pb-6">
            <div className="flex justify-end gap-2">{actions}</div>
          </div>
        )}
      </Card>
    );
  }
);
StatusCard.displayName = 'StatusCard';

export { StatusCard };