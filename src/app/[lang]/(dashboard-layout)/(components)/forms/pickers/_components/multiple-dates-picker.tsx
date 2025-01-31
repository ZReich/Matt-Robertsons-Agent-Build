"use client";

import * as React from "react";

import { MultipleDatesPicker as MultipleDatesPickerComponent } from "@/components/multiple-date-picker";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export function MultipleDatesPicker() {
  const [dates, setDates] = React.useState<Date[] | undefined>([]);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Multiple Dates Picker</CardTitle>
      </CardHeader>
      <CardContent className="grid gap-2">
        <MultipleDatesPickerComponent value={dates} onValueChange={setDates} />
      </CardContent>
    </Card>
  );
}
