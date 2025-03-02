"use client";

import * as React from "react";

import { DatePicker } from "@/components/date-picker";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export function DatePickerPlaceholder() {
  const [date, setDate] = React.useState<Date | undefined>();

  return (
    <Card>
      <CardHeader>
        <CardTitle>Date Picker Placeholder</CardTitle>
      </CardHeader>
      <CardContent className="grid gap-2">
        <DatePicker
          value={date}
          onValueChange={setDate}
          placeholder="Select date"
        />
      </CardContent>
    </Card>
  );
}
