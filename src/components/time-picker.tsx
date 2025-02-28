"use client";

import * as React from "react";
import { format } from "date-fns";
import { Clock } from "lucide-react";

import { cn, timeToDate } from "@/lib/utils";

import type { InputTimeProps } from "@/components/ui/input-time";

import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { InputTime } from "@/components/ui/input-time";

export interface TimePickerProps extends InputTimeProps {
  value: string | undefined;
  popoverContentClassName?: string;
  buttonClassName?: string;
  placeholder?: string;
}

const TimePicker = React.forwardRef<HTMLButtonElement, TimePickerProps>(
  (
    {
      value,
      popoverContentClassName,
      buttonClassName,
      placeholder = "Pick time",
      ...props
    },
    ref
  ) => {
    return (
      <Popover>
        <PopoverTrigger asChild>
          <Button
            ref={ref}
            variant="outline"
            className={cn(
              "w-full px-3 text-start font-normal",
              buttonClassName
            )}
          >
            {value ? (
              format(timeToDate(value), "p")
            ) : (
              <span className="text-muted-foreground">{placeholder}</span>
            )}
            <Clock className="ms-auto h-4 w-4 text-muted-foreground" />
          </Button>
        </PopoverTrigger>
        <PopoverContent
          className={cn("w-auto p-0", popoverContentClassName)}
          align="start"
        >
          <InputTime className="border-0" value={value} {...props} />
        </PopoverContent>
      </Popover>
    );
  }
);
TimePicker.displayName = "TimePicker";

export { TimePicker };
