"use client"

import * as React from "react"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { DatePicker as DatePickerComponent } from "@/components/date-picker"

export function DatePicker() {
  const [date, setDate] = React.useState<Date | undefined>()

  return (
    <Card>
      <CardHeader>
        <CardTitle>Date Picker</CardTitle>
      </CardHeader>
      <CardContent className="grid gap-2">
        <DatePickerComponent value={date} onValueChange={setDate} />
      </CardContent>
    </Card>
  )
}
