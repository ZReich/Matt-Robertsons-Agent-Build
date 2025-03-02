"use client";

import * as React from "react";
import { format } from "date-fns";
import { CalendarIcon } from "lucide-react";

import { cn } from "@/lib/utils";

import type { CalendarProps } from "@/components/ui/calendar";
import type { ButtonProps } from "@/components/ui/button";

import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

export type MultipleDatesPickerProps = Omit<
  CalendarProps,
  "mode" | "selected" | "onSelect"
> & {
  value?: Date[];
  onValueChange: (dates?: Date[]) => void;
  formatStr?: string;
  popoverContentClassName?: string;
  popoverContentOptions?: React.ComponentPropsWithoutRef<typeof PopoverContent>;
  buttonClassName?: string;
  buttonOptions?: ButtonProps;
  placeholder?: string;
};

const MultipleDatesPicker = React.forwardRef<
  HTMLButtonElement,
  MultipleDatesPickerProps
>(
  (
    {
      value,
      onValueChange,
      formatStr = "yyyy-MM-dd p",
      popoverContentClassName,
      popoverContentOptions,
      buttonClassName,
      buttonOptions,
      placeholder = "Pick dates",
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
            {value && value.length > 0 ? (
              <span>
                {value.map((date) => format(date, formatStr)).join(", ")}
              </span>
            ) : (
              <span className="text-muted-foreground">{placeholder}</span>
            )}
            <CalendarIcon className="ms-auto h-4 w-4 text-muted-foreground" />
          </Button>
        </PopoverTrigger>
        <PopoverContent
          className={cn("w-auto p-0", popoverContentClassName)}
          align="start"
          {...popoverContentOptions}
        >
          <Calendar
            initialFocus
            mode="multiple"
            selected={value}
            onSelect={onValueChange}
            {...props}
          />
        </PopoverContent>
      </Popover>
    );
  }
);
MultipleDatesPicker.displayName = "MultipleDatesPicker";

export { MultipleDatesPicker };
