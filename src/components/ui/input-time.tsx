import * as React from "react";
import { Clock } from "lucide-react";

import { cn } from "@/lib/utils";

import { Input } from "./input";

export interface InputTimeProps
  extends React.InputHTMLAttributes<HTMLInputElement> {
  onValueChange?: (value?: string) => void;
  indicator?: boolean;
}

const InputTime = React.forwardRef<HTMLInputElement, InputTimeProps>(
  ({ className, onValueChange, indicator = true, ...props }, ref) => {
    const [isEmpty, setIsEmpty] = React.useState(
      !props.defaultValue && !props.value
    );

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const value = e.target.value;

      setIsEmpty(!value);
      onValueChange?.(value);
    };

    return (
      <div className="relative">
        <Input
          ref={ref}
          className={cn(
            "block",
            isEmpty && "text-muted-foreground",
            indicator
              ? "[&::-webkit-calendar-picker-indicator]:size-3.5 [&::-webkit-calendar-picker-indicator]:-me-0.5 [&::-webkit-calendar-picker-indicator]:z-10 [&::-webkit-calendar-picker-indicator]:opacity-0"
              : "[&::-webkit-calendar-picker-indicator]:hidden",
            className
          )}
          {...props}
          type="time"
          onChange={handleChange}
        />
        {indicator && (
          <Clock
            className="absolute top-1/2 end-3 h-4 w-4 text-muted-foreground -translate-y-1/2"
            aria-hidden
          />
        )}
      </div>
    );
  }
);
InputTime.displayName = "InputTime";

export { InputTime };
