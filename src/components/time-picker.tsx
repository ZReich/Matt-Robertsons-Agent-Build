"use client";

import * as React from "react";
import { format } from "date-fns";
import { Clock } from "lucide-react";

import { timeToDate } from "@/lib/utils";

import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { InputTime } from "@/components/ui/input-time";

export interface TimePickerProps {
  value: string | undefined;
  onValueChange: (value: string | undefined) => void;
}

export function TimePicker({ value, onValueChange }: TimePickerProps) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          className="w-full px-3 text-start font-normal"
        >
          {value ? (
            format(timeToDate(value), "p")
          ) : (
            <span className="text-muted-foreground">Pick date and time</span>
          )}
          <Clock className="ms-auto h-4 w-4 text-muted-foreground" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <InputTime
          indicator={false}
          className="border-0"
          value={value}
          onValueChange={onValueChange}
        />
      </PopoverContent>
    </Popover>
  );
}
