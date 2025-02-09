"use client";

import * as React from "react";

import { DatePicker } from "@/components/date-picker";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export function HumanFriendlyDatePicker() {
  const [date, setDate] = React.useState<Date | undefined>();

  return (
    <Card>
      <CardHeader>
        <CardTitle>Human Friendly Date Picker</CardTitle>
      </CardHeader>
      <CardContent className="grid gap-2">
        <DatePicker formatStr="PPP" value={date} onValueChange={setDate} />
      </CardContent>
    </Card>
  );
}
