"use client";

import * as React from "react";

import type { DateRange } from "react-day-picker";

import { DateRangePicker as DateRangePickerComponent } from "@/components/date-range-picker";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export function DateRangePicker() {
  const [range, setRange] = React.useState<DateRange>();

  return (
    <Card>
      <CardHeader>
        <CardTitle>Date Range Picker</CardTitle>
      </CardHeader>
      <CardContent className="grid gap-2">
        <DateRangePickerComponent value={range} onValueChange={setRange} />
      </CardContent>
    </Card>
  );
}
