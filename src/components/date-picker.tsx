"use client";

import * as React from "react";
import { format } from "date-fns";
import { CalendarIcon } from "lucide-react";

import type { CalendarProps } from "@/components/ui/calendar";

import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

export type DatePickerProps = CalendarProps & {
  value?: Date;
  onValueChange?: (date?: Date) => void;
  formatStr?: string;
};

export function DatePicker({
  value,
  onValueChange,
  formatStr = "yyyy-MM-dd",
  ...props
}: DatePickerProps) {
  return (
    <Popover modal>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          className="w-full px-3 text-start font-normal"
        >
          {value ? (
            format(value, formatStr)
          ) : (
            <span className="text-muted-foreground">Pick date and time</span>
          )}
          <CalendarIcon className="ms-auto h-4 w-4 text-muted-foreground" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
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
