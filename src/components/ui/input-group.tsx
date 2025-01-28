import * as React from "react";

import { cn } from "@/lib/utils";

export interface InputGroupProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
}

const InputGroup = React.forwardRef<HTMLDivElement, InputGroupProps>(
  ({ className, children, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn(
          "flex min-h-9 w-full rounded-md border border-input bg-transparent text-sm shadow-sm transition-colors [&>*:not(.input-group-text)]:border-0 [&>input]:z-10 first:[&>input]:rounded-e-none last:[&>input]:rounded-s-none [&>input:not(:first-child):not(:last-child)]:rounded-none [&>textarea]:z-10 first:[&>textarea]:rounded-e-none last:[&>textarea]:rounded-s-none [&>textarea:not(:first-child):not(:last-child)]:rounded-none first:[&>button]:rounded-e-none last:[&>button]:rounded-s-none [&:not(:first-child):not(:last-child)]:[&>button]:rounded-none",
          className
        )}
        {...props}
      >
        {children}
      </div>
    );
  }
);
InputGroup.displayName = "InputGroup";

export interface InputGroupTextProps
  extends React.HTMLAttributes<HTMLDivElement> {
  merged?: boolean;
}

const InputGroupText = React.forwardRef<HTMLDivElement, InputGroupTextProps>(
  ({ className, merged = false, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn(
          "input-group-text",
          "flex items-center justify-center border-input px-3 py-1 text-sm text-muted-foreground",
          !merged &&
            "first:rounded-s-md last:rounded-e-md first:border-e last:border-s [&:not(:first-child):not(:last-child)]:border-x",
          className
        )}
        {...props}
      />
    );
  }
);
InputGroupText.displayName = "InputGroupText";

export { InputGroup, InputGroupText };
