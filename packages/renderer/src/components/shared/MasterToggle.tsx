import * as React from 'react';
import * as SwitchPrimitives from '@radix-ui/react-switch';
import { cn } from '../../lib/utils';

interface MasterToggleProps {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  disabled?: boolean;
  size?: 'default' | 'lg';
}

export function MasterToggle({
  checked,
  onCheckedChange,
  disabled,
  size = 'default',
}: MasterToggleProps) {
  return (
    <SwitchPrimitives.Root
      checked={checked}
      onCheckedChange={onCheckedChange}
      disabled={disabled}
      className={cn(
        'peer inline-flex shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent',
        'transition-colors duration-200 ease-in-out',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background',
        'disabled:cursor-not-allowed disabled:opacity-50',
        checked
          ? 'bg-foreground'
          : 'bg-muted',
        size === 'lg' ? 'h-7 w-12' : 'h-5 w-9'
      )}
    >
      <SwitchPrimitives.Thumb
        className={cn(
          'pointer-events-none block rounded-full bg-background shadow-sm ring-0',
          'transition-transform duration-200 ease-in-out',
          checked
            ? size === 'lg'
              ? 'translate-x-5'
              : 'translate-x-4'
            : 'translate-x-0',
          size === 'lg' ? 'h-6 w-6' : 'h-4 w-4'
        )}
      />
    </SwitchPrimitives.Root>
  );
}
