"use client";

import * as React from "react";
import { format } from "date-fns";
import { Clock } from "lucide-react";

import { cn, timeToDate } from "@/lib/utils";

import type { InputTimeProps } from "@/components/ui/input-time";
import type { ButtonProps } from "@/components/ui/button";

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
  popoverContentOptions: React.ComponentPropsWithoutRef<typeof PopoverContent>;
  buttonClassName?: string;
  buttonOptions?: ButtonProps;
  placeholder?: string;
}

const TimePicker = React.forwardRef<HTMLButtonElement, TimePickerProps>(
  (
    {
      value,
      popoverContentClassName,
      popoverContentOptions,
      buttonClassName,
      buttonOptions,
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
              <span>{format(timeToDate(value), "p")}</span>
            ) : (
              <span className="text-muted-foreground">{placeholder}</span>
            )}
            <Clock className="ms-auto h-4 w-4 text-muted-foreground" />
          </Button>
        </PopoverTrigger>
        <PopoverContent
          className={cn("w-auto p-0", popoverContentClassName)}
          align="start"
          {...popoverContentOptions}
        >
          <InputTime className="border-0" value={value} {...props} />
        </PopoverContent>
      </Popover>
    );
  }
);
TimePicker.displayName = "TimePicker";

export { TimePicker };
