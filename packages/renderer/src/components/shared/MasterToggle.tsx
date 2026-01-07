import * as React from 'react';
import { Switch } from '../ui/switch';

interface MasterToggleProps {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  disabled?: boolean;
}

export function MasterToggle({
  checked,
  onCheckedChange,
  disabled,
}: MasterToggleProps) {
  return (
    <Switch
      checked={checked}
      onCheckedChange={onCheckedChange}
      disabled={disabled}
    />
  );
}
