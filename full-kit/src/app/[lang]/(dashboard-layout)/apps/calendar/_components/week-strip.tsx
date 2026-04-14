"use client"

import { addDays, format, isToday, startOfWeek } from "date-fns"

interface WeekStripProps {
  /** ISO date strings of days that have meetings */
  meetingDates: string[]
}

export function WeekStrip({ meetingDates }: WeekStripProps) {
  const today = new Date()
  const weekStart = startOfWeek(today, { weekStartsOn: 1 }) // Monday

  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i))

  // Set of "YYYY-MM-DD" strings that have meetings
  const meetingDaySet = new Set(
    meetingDates.map((d) => format(new Date(d), "yyyy-MM-dd"))
  )

  return (
    <div className="flex gap-1 w-full">
      {days.map((day) => {
        const key = format(day, "yyyy-MM-dd")
        const hasMeeting = meetingDaySet.has(key)
        const todayDay = isToday(day)

        return (
          <div
            key={key}
            className="flex flex-col items-center flex-1 gap-1 py-2 rounded-lg"
          >
            <span className="text-xs text-muted-foreground font-medium">
              {format(day, "EEE")}
            </span>
            <div
              className={`flex size-8 items-center justify-center rounded-full text-sm font-semibold transition-colors ${
                todayDay
                  ? "bg-primary text-primary-foreground"
                  : "text-foreground"
              }`}
            >
              {format(day, "d")}
            </div>
            <div className="h-1.5 w-1.5 rounded-full">
              {hasMeeting && (
                <div
                  className={`h-1.5 w-1.5 rounded-full ${
                    todayDay ? "bg-primary-foreground" : "bg-primary"
                  }`}
                />
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}
