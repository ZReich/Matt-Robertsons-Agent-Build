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
import { InputTime } from "@/components/ui/input-time";
import { Separator } from "@/components/ui/separator";

export type DateTimePickerProps = CalendarProps &
  React.HTMLAttributes<HTMLDivElement> & {
    value?: Date;
    onValueChange?: (date?: Date) => void;
    formatStr?: string;
  };

const DateTimePicker = React.forwardRef<HTMLButtonElement, DateTimePickerProps>(
  ({ value, onValueChange, formatStr = "yyyy-MM-dd p", ...props }, ref) => {
    const [selectedDate, setSelectedDate] = React.useState<Date | undefined>(
      value
    );

    const handleDateSelect = (selected?: Date) => {
      if (!selected) return;

      // Preserve the time when changing the date
      const newDateTime = new Date(selected);
      if (selectedDate) {
        newDateTime.setHours(selectedDate.getHours());
        newDateTime.setMinutes(selectedDate.getMinutes());
      }

      setSelectedDate(newDateTime);
      onValueChange?.(newDateTime);
    };

    const handleTimeChange = (timeString?: string) => {
      if (!timeString) return;

      const [hours, minutes] = timeString.split(":").map(Number);

      if (selectedDate) {
        const newDateTime = new Date(selectedDate);
        newDateTime.setHours(hours);
        newDateTime.setMinutes(minutes);

        setSelectedDate(newDateTime);
        onValueChange?.(newDateTime);
      }
    };

    return (
      <Popover modal>
        <PopoverTrigger asChild>
          <Button
            ref={ref}
            variant="outline"
            className="w-full px-3 text-start font-normal"
          >
            {selectedDate ? (
              format(selectedDate, formatStr)
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
            selected={selectedDate}
            onSelect={handleDateSelect}
          />
          <Separator />
          <InputTime
            className="rounded-t-none border-0"
            onValueChange={handleTimeChange}
            value={selectedDate ? format(selectedDate, "p") : undefined}
          />
        </PopoverContent>
      </Popover>
    );
  }
);
DateTimePicker.displayName = "DateTimePicker";

export { DateTimePicker };
