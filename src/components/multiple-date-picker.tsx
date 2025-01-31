import * as React from "react";
import { format } from "date-fns";
import { CalendarIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

interface MultipleDatesPickerProps {
  value?: Date[];
  onValueChange: (dates?: Date[]) => void;
  formatStr?: string;
}

export const MultipleDatesPicker: React.FC<MultipleDatesPickerProps> = ({
  value,
  onValueChange,
  formatStr = "yyyy-MM-dd",
}) => (
  <Popover>
    <PopoverTrigger asChild>
      <Button variant="outline" className="w-full px-3 text-start font-normal">
        {value && value.length > 0 ? (
          value.map((date) => format(date, formatStr)).join(", ")
        ) : (
          <span className="text-muted-foreground">Pick date and time</span>
        )}
        <CalendarIcon className="ms-auto h-4 w-4 text-muted-foreground" />
      </Button>
    </PopoverTrigger>
    <PopoverContent className="w-auto p-0" align="start">
      <Calendar
        mode="multiple"
        selected={value}
        onSelect={onValueChange}
        disabled={(date) => date > new Date() || date < new Date("1900-01-01")}
        initialFocus
      />
    </PopoverContent>
  </Popover>
);
