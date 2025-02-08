"use client";

import * as React from "react";

import { cn } from "@/lib/utils";

import { Input } from "./input";

export interface InputTimeProps
  extends React.InputHTMLAttributes<HTMLInputElement> {
  onValueChange?: (value?: string) => void;
}

const InputTime = React.forwardRef<HTMLInputElement, InputTimeProps>(
  ({ className, onValueChange, ...props }, ref) => {
    const [isEmpty, setIsEmpty] = React.useState(
      !props.defaultValue && !props.value
    );

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const value = e.target.value;

      setIsEmpty(!value);
      onValueChange?.(value);
    };

    return (
      <Input
        ref={ref}
        className={cn(
          "block [&::-webkit-calendar-picker-indicator]:hidden rtl:text-right",
          isEmpty && "text-muted-foreground",
          className
        )}
        {...props}
        type="time"
        onChange={handleChange}
      />
    );
  }
);
InputTime.displayName = "InputTime";

export { InputTime };
