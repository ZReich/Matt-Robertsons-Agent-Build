import * as React from "react";

import { cn } from "@/lib/utils";

export interface KeyboardProps extends React.HTMLProps<HTMLElement> {}

const Keyboard = React.forwardRef<HTMLElement, KeyboardProps>(
  ({ className, children, ...props }, ref) => {
    return (
      <kbd
        className={cn(
          "pointer-events-none inline-flex h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground opacity-100",
          className
        )}
        ref={ref}
        {...props}
      >
        <span className="text-xs">⌘</span>
        {children}
      </kbd>
    );
  }
);
Keyboard.displayName = "Keyboard";

export { Keyboard };
