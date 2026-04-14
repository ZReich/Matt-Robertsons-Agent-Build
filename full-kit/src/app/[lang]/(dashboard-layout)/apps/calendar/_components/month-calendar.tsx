"use client"

import { useState } from "react"
import {
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isSameDay,
  isSameMonth,
  isToday,
  startOfMonth,
  startOfWeek,
  subMonths,
} from "date-fns"
import { ChevronLeft, ChevronRight, Clock, MapPin } from "lucide-react"

import type { MeetingMeta, VaultNote } from "@/lib/vault/shared"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"

type MeetingNote = VaultNote<MeetingMeta>

interface MonthCalendarProps {
  meetings: MeetingNote[]
}

const DAY_HEADERS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]

function formatDuration(minutes: number): string {
  if (minutes < 60) return `${minutes} min`
  const hrs = Math.floor(minutes / 60)
  const mins = minutes % 60
  return mins ? `${hrs}h ${mins}m` : `${hrs} hr`
}

export function MonthCalendar({ meetings }: MonthCalendarProps) {
  const [currentMonth, setCurrentMonth] = useState(new Date())
  const [selectedDay, setSelectedDay] = useState<Date | null>(new Date())

  const monthStart = startOfMonth(currentMonth)
  const monthEnd = endOfMonth(currentMonth)
  const gridStart = startOfWeek(monthStart, { weekStartsOn: 1 })
  const gridEnd = endOfWeek(monthEnd, { weekStartsOn: 1 })
  const days = eachDayOfInterval({ start: gridStart, end: gridEnd })

  // Build a Set of "yyyy-MM-dd" → meetings for fast lookup
  const meetingsByDay = new Map<string, MeetingNote[]>()
  for (const meeting of meetings) {
    const key = format(new Date(meeting.meta.date), "yyyy-MM-dd")
    const existing = meetingsByDay.get(key) ?? []
    existing.push(meeting)
    meetingsByDay.set(key, existing)
  }

  const selectedDayMeetings = selectedDay
    ? (meetingsByDay.get(format(selectedDay, "yyyy-MM-dd")) ?? []).sort(
        (a, b) =>
          new Date(a.meta.date).getTime() - new Date(b.meta.date).getTime()
      )
    : []

  return (
    <div className="space-y-4">
      {/* Month navigation */}
      <div className="flex items-center justify-between">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setCurrentMonth((m) => subMonths(m, 1))}
        >
          <ChevronLeft className="size-4" />
        </Button>
        <h2 className="text-base font-semibold">
          {format(currentMonth, "MMMM yyyy")}
        </h2>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setCurrentMonth((m) => addMonths(m, 1))}
        >
          <ChevronRight className="size-4" />
        </Button>
      </div>

      {/* Day headers */}
      <div className="grid grid-cols-7 text-center">
        {DAY_HEADERS.map((d) => (
          <div
            key={d}
            className="text-xs font-semibold text-muted-foreground py-1"
          >
            {d}
          </div>
        ))}
      </div>

      {/* Calendar grid */}
      <div className="grid grid-cols-7 gap-px bg-border rounded-lg overflow-hidden">
        {days.map((day) => {
          const key = format(day, "yyyy-MM-dd")
          const dayMeetings = meetingsByDay.get(key) ?? []
          const isCurrentMonth = isSameMonth(day, currentMonth)
          const todayDay = isToday(day)
          const isSelected = selectedDay ? isSameDay(day, selectedDay) : false

          return (
            <button
              key={key}
              onClick={() => setSelectedDay(day)}
              className={`
                bg-card min-h-[72px] p-2 text-left transition-colors hover:bg-accent/50 focus:outline-none
                ${!isCurrentMonth ? "opacity-40" : ""}
                ${isSelected ? "ring-2 ring-primary ring-inset" : ""}
              `}
            >
              <div
                className={`
                  flex size-6 items-center justify-center rounded-full text-xs font-semibold mb-1
                  ${todayDay ? "bg-primary text-primary-foreground" : "text-foreground"}
                `}
              >
                {format(day, "d")}
              </div>
              <div className="space-y-0.5">
                {dayMeetings.slice(0, 2).map((m) => (
                  <div
                    key={m.path}
                    className="text-xs truncate px-1 py-0.5 rounded bg-primary/10 text-primary leading-tight"
                  >
                    {format(new Date(m.meta.date), "h:mm")} {m.meta.title}
                  </div>
                ))}
                {dayMeetings.length > 2 && (
                  <div className="text-xs text-muted-foreground px-1">
                    +{dayMeetings.length - 2} more
                  </div>
                )}
              </div>
            </button>
          )
        })}
      </div>

      {/* Selected day meetings */}
      {selectedDay && (
        <div>
          <p className="text-sm font-semibold mb-2">
            {format(selectedDay, "EEEE, MMMM d")}
          </p>
          {selectedDayMeetings.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No meetings on this day.
            </p>
          ) : (
            <div className="space-y-2">
              {selectedDayMeetings.map((m) => {
                const dealName = m.meta.deal?.replace(/\[\[|\]\]/g, "")
                return (
                  <Card key={m.path}>
                    <CardContent className="p-4 flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="font-medium text-sm">{m.meta.title}</p>
                          {m.meta.category === "personal" && (
                            <Badge variant="secondary" className="text-xs">
                              Personal
                            </Badge>
                          )}
                          {dealName && (
                            <Badge variant="outline" className="text-xs py-0">
                              {dealName}
                            </Badge>
                          )}
                        </div>
                        {m.meta.contact && (
                          <p className="text-xs text-muted-foreground mt-0.5">
                            {m.meta.contact}
                          </p>
                        )}
                        <div className="flex flex-wrap gap-3 mt-1">
                          {m.meta.location && (
                            <span className="flex items-center gap-1 text-xs text-muted-foreground">
                              <MapPin className="size-3" />
                              {m.meta.location}
                            </span>
                          )}
                          {m.meta.duration_minutes && (
                            <span className="flex items-center gap-1 text-xs text-muted-foreground">
                              <Clock className="size-3" />
                              {formatDuration(m.meta.duration_minutes)}
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-sm font-semibold">
                          {format(new Date(m.meta.date), "h:mm a")}
                        </p>
                      </div>
                    </CardContent>
                  </Card>
                )
              })}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
