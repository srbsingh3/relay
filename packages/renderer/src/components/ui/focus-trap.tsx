import * as React from 'react';
import { focusTrap } from 'focus-trap';
import { cn } from '../../lib/utils';

interface FocusTrapProps {
  children: React.ReactNode;
  className?: string;
  active?: boolean;
  onEscape?: () => void;
}

const FocusTrap = React.forwardRef<HTMLDivElement, FocusTrapProps>(
  ({ children, className, active = true, onEscape }, ref) => {
    const containerRef = React.useRef<HTMLDivElement>(null);
    const trapRef = React.useRef<ReturnType<typeof focusTrap> | null>(null);

    React.useEffect(() => {
      if (!active || !containerRef.current) return;

      trapRef.current = focusTrap(containerRef.current, {
        escapeDeactivates: true,
        onDeactivate: onEscape,
      });

      trapRef.current.activate();

      return () => {
        if (trapRef.current) {
          trapRef.current.deactivate();
          trapRef.current = null;
        }
      };
    }, [active, onEscape]);

    React.useImperativeHandle(ref, () => containerRef.current!);

    return (
      <div ref={containerRef} className={cn('focus-trap', className)}>
        {children}
      </div>
    );
  }
);
FocusTrap.displayName = 'FocusTrap';

export { FocusTrap };