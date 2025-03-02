"use client";

import * as React from "react";
import { format } from "date-fns";
import { CalendarIcon } from "lucide-react";

import type { CalendarProps } from "@/components/ui/calendar";
import type { ButtonProps } from "@/components/ui/button";

import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";

export type DatePickerProps = CalendarProps & {
  value?: Date;
  onValueChange?: (date?: Date) => void;
  formatStr?: string;
  popoverContentClassName?: string;
  popoverContentOptions: React.ComponentPropsWithoutRef<typeof PopoverContent>;
  buttonClassName?: string;
  buttonOptions?: ButtonProps;
  placeholder?: string;
};

const DatePicker = React.forwardRef<HTMLButtonElement, DatePickerProps>(
  (
    {
      value,
      onValueChange,
      formatStr = "yyyy-MM-dd",
      popoverContentClassName,
      popoverContentOptions,
      buttonClassName,
      buttonOptions,
      placeholder = "Pick date",
      ...props
    },
    ref
  ) => {
    return (
      <Popover modal>
        <PopoverTrigger asChild>
          <Button
            ref={ref}
            variant="outline"
            className={cn(
              "w-full px-3 text-start font-normal",
              buttonClassName
            )}
            {...buttonOptions}
          >
            {value ? (
              <span>{format(value, formatStr)}</span>
            ) : (
              <span className="text-muted-foreground">{placeholder}</span>
            )}
            <CalendarIcon className="shrink-0 h-4 w-4 ms-auto text-muted-foreground" />
          </Button>
        </PopoverTrigger>
        <PopoverContent
          className={cn("w-auto p-0", popoverContentClassName)}
          align="start"
          {...popoverContentOptions}
        >
          <Calendar
            initialFocus
            {...props}
            mode="single"
            selected={value}
            onSelect={onValueChange}
          />
        </PopoverContent>
      </Popover>
    );
  }
);
DatePicker.displayName = "DatePicker";

export { DatePicker };
