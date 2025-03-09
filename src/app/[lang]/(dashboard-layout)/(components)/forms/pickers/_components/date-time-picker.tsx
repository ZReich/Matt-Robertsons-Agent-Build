"use client"

import * as React from "react"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { DateTimePicker as DateTimePickerComponent } from "@/components/date-time-picker"

export function DateTimePicker() {
  const [dateTime, setDateTime] = React.useState<Date | undefined>()

  return (
    <Card>
      <CardHeader>
        <CardTitle>Date Time Picker</CardTitle>
      </CardHeader>
      <CardContent className="grid gap-2">
        <DateTimePickerComponent value={dateTime} onValueChange={setDateTime} />
      </CardContent>
    </Card>
  )
}
