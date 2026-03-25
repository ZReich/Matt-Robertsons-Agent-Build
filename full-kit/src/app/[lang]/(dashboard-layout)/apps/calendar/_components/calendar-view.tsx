"use client"

import { useState } from "react"
import { format, isBefore, startOfDay, subDays } from "date-fns"
import { Clock, LayoutList, MapPin } from "lucide-react"

import type { MeetingMeta, VaultNote } from "@/lib/vault"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"

import { MonthCalendar } from "./month-calendar"
import { WeekStrip } from "./week-strip"

type MeetingNote = VaultNote<MeetingMeta>

interface CalendarViewProps {
  meetings: MeetingNote[]
}

function formatDuration(minutes: number): string {
  if (minutes < 60) return `${minutes} min`
  const hrs = Math.floor(minutes / 60)
  const mins = minutes % 60
  return mins ? `${hrs}h ${mins}m` : `${hrs} hr`
}

export function CalendarView({ meetings }: CalendarViewProps) {
  const [view, setView] = useState<"list" | "month">("list")

  const now = new Date()
  const todayStart = startOfDay(now)
  const thirtyDaysAgo = subDays(todayStart, 30)

  const upcoming = [...meetings]
    .filter((m) => !isBefore(new Date(m.meta.date), todayStart))
    .sort(
      (a, b) =>
        new Date(a.meta.date).getTime() - new Date(b.meta.date).getTime()
    )

  const past = [...meetings]
    .filter(
      (m) =>
        isBefore(new Date(m.meta.date), todayStart) &&
        !isBefore(new Date(m.meta.date), thirtyDaysAgo)
    )
    .sort(
      (a, b) =>
        new Date(b.meta.date).getTime() - new Date(a.meta.date).getTime()
    )

  const meetingDates = meetings.map((m) => m.meta.date)

  return (
    <div className="space-y-4">
      {/* View toggle */}
      <div className="flex gap-2">
        <Button
          variant={view === "list" ? "default" : "outline"}
          size="sm"
          onClick={() => setView("list")}
          className="gap-1.5"
        >
          <LayoutList className="size-3.5" /> List
        </Button>
        <Button
          variant={view === "month" ? "default" : "outline"}
          size="sm"
          onClick={() => setView("month")}
          className="gap-1.5"
        >
          <span className="text-sm">▦</span> Month
        </Button>
      </div>

      {view === "month" ? (
        <MonthCalendar meetings={meetings} />
      ) : (
        <div className="space-y-6">
          {/* Week strip */}
          <Card>
            <CardContent className="p-4">
              <WeekStrip meetingDates={meetingDates} />
            </CardContent>
          </Card>

          {/* Upcoming */}
          <div>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">
              Upcoming
            </p>
            {upcoming.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No upcoming meetings scheduled.
              </p>
            ) : (
              <div className="space-y-3">
                {upcoming.map((m) => {
                  const dealName = m.meta.deal?.replace(/\[\[|\]\]/g, "")
                  return (
                    <Card key={m.path}>
                      <CardContent className="p-4">
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <p className="font-semibold text-sm">
                                {m.meta.title}
                              </p>
                              {m.meta.category === "personal" && (
                                <Badge variant="secondary" className="text-xs">
                                  Personal
                                </Badge>
                              )}
                              {dealName && (
                                <Badge
                                  variant="outline"
                                  className="text-xs py-0"
                                >
                                  {dealName}
                                </Badge>
                              )}
                            </div>
                            {m.meta.contact && (
                              <p className="text-xs text-muted-foreground mt-1">
                                {m.meta.contact}
                              </p>
                            )}
                            <div className="flex flex-wrap gap-3 mt-2">
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
                              {format(new Date(m.meta.date), "MMM d")}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {format(new Date(m.meta.date), "h:mm a")}
                            </p>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  )
                })}
              </div>
            )}
          </div>

          {/* Past (last 30 days) */}
          {past.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">
                Past (last 30 days)
              </p>
              <div className="space-y-3">
                {past.map((m) => {
                  const dealName = m.meta.deal?.replace(/\[\[|\]\]/g, "")
                  return (
                    <Card key={m.path} className="opacity-75">
                      <CardContent className="p-4">
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <p className="font-medium text-sm">
                                {m.meta.title}
                              </p>
                              {dealName && (
                                <Badge
                                  variant="outline"
                                  className="text-xs py-0"
                                >
                                  {dealName}
                                </Badge>
                              )}
                            </div>
                            {m.meta.contact && (
                              <p className="text-xs text-muted-foreground mt-1">
                                {m.meta.contact}
                              </p>
                            )}
                            {m.meta.duration_minutes && (
                              <span className="flex items-center gap-1 text-xs text-muted-foreground mt-1">
                                <Clock className="size-3" />
                                {formatDuration(m.meta.duration_minutes)}
                              </span>
                            )}
                          </div>
                          <div className="text-right shrink-0">
                            <p className="text-sm font-medium">
                              {format(new Date(m.meta.date), "MMM d")}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {format(new Date(m.meta.date), "h:mm a")}
                            </p>
                            <Badge
                              variant="outline"
                              className="text-xs mt-1 text-muted-foreground"
                            >
                              Past
                            </Badge>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  )
                })}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
