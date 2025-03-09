"use client"

import * as React from "react"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { TimePicker as TimePickerComponent } from "@/components/time-picker"

export function TimePicker() {
  const [time, setTime] = React.useState<string | undefined>()

  return (
    <Card>
      <CardHeader>
        <CardTitle>Time Picker</CardTitle>
      </CardHeader>
      <CardContent className="grid gap-2">
        <TimePickerComponent value={time} onValueChange={setTime} />
      </CardContent>
    </Card>
  )
}
