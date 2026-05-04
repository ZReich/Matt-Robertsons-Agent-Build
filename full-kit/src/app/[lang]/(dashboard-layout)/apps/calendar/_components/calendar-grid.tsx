"use client"

import { useMemo, useState } from "react"
import dayGridPlugin from "@fullcalendar/daygrid"
import interactionPlugin from "@fullcalendar/interaction"
import multiMonthPlugin from "@fullcalendar/multimonth"
import FullCalendar from "@fullcalendar/react"
import { useDirection } from "@radix-ui/react-direction"

import type { EventInput } from "@fullcalendar/core/index.js"
import type { EventImpl } from "@fullcalendar/core/internal"

import { cn } from "@/lib/utils"

import { EventDetailDrawer } from "./event-detail-drawer"

import type { DrawerSubject } from "./event-detail-drawer"

// =============================================================================
// DTOs — shape returned by page.tsx (server component) to this client widget.
// =============================================================================

export interface CalendarMeetingDTO {
  id: string
  title: string
  date: string
  endDate: string | null
  durationMinutes: number | null
  location: string | null
  notes: string | null
  category: string
  dealId: string | null
  deal: { id: string; name: string } | null
  attendees: Array<{
    id: string
    role: string | null
    contact: { id: string; name: string; email: string | null } | null
  }>
}

export interface CalendarEventDTO {
  id: string
  title: string
  description: string | null
  startDate: string
  endDate: string | null
  allDay: boolean
  eventKind: string
  source: string
  status: string
  contactId: string | null
  contact: { id: string; name: string; email: string | null } | null
  propertyId: string | null
  property: { id: string; name: string | null; address: string } | null
  dealId: string | null
  deal: { id: string; name: string } | null
  leaseRecordId: string | null
  leaseRecord: {
    id: string
    leaseEndDate: string | null
    leaseStartDate: string | null
    leaseTermMonths: number | null
    rentAmount: string | null
    rentPeriod: string | null
    mattRepresented: string | null
    status: string
    dealKind: string
  } | null
}

// =============================================================================
// Filter chips
// =============================================================================

type FilterKey = "all" | "meetings" | "lease_renewals" | "follow_ups"

const FILTER_LABELS: Record<FilterKey, string> = {
  all: "All",
  meetings: "Meetings",
  lease_renewals: "Lease Renewals",
  follow_ups: "Follow-ups",
}

const FILTERS: FilterKey[] = ["all", "meetings", "lease_renewals", "follow_ups"]

// =============================================================================
// Color map per event kind. Returned hex values are intentional rather than
// hsl(var(--chart-X)) so events render the same color in light/dark themes
// and so the renewal-outreach red is unmistakably "act now."
// =============================================================================

const EVENT_KIND_COLORS: Record<string, { bg: string; border: string }> = {
  lease_renewal: { bg: "#f59e0b", border: "#d97706" }, // amber
  lease_renewal_outreach: { bg: "#dc2626", border: "#b91c1c" }, // red
  meeting: { bg: "#3b82f6", border: "#2563eb" }, // blue
  follow_up: { bg: "#a855f7", border: "#9333ea" }, // purple
  anniversary: { bg: "#16a34a", border: "#15803d" }, // green
}

const DEFAULT_COLOR = { bg: "#6b7280", border: "#4b5563" } // gray

function colorFor(kind: string): { bg: string; border: string } {
  return EVENT_KIND_COLORS[kind] ?? DEFAULT_COLOR
}

interface CalendarGridProps {
  lang: string
  meetings: CalendarMeetingDTO[]
  calendarEvents: CalendarEventDTO[]
}

export function CalendarGrid({
  lang,
  meetings,
  calendarEvents,
}: CalendarGridProps) {
  const direction = useDirection()
  const [filter, setFilter] = useState<FilterKey>("all")
  const [drawerSubject, setDrawerSubject] = useState<DrawerSubject | null>(null)

  // Index by `extendedProps.kind` source so eventClick can look the row up.
  const meetingMap = useMemo(
    () => new Map(meetings.map((m) => [m.id, m])),
    [meetings]
  )
  const eventMap = useMemo(
    () => new Map(calendarEvents.map((e) => [e.id, e])),
    [calendarEvents]
  )

  const events = useMemo<EventInput[]>(() => {
    const list: EventInput[] = []

    // Meetings get tagged with kind="meeting" so the filter chips work.
    if (filter === "all" || filter === "meetings") {
      for (const m of meetings) {
        const c = colorFor("meeting")
        list.push({
          id: `m:${m.id}`,
          title: m.title,
          start: m.date,
          end: m.endDate ?? undefined,
          allDay: !m.durationMinutes,
          backgroundColor: c.bg,
          borderColor: c.border,
          textColor: "#ffffff",
          extendedProps: {
            source: "meeting",
            recordId: m.id,
            kind: "meeting",
          },
        })
      }
    }

    for (const e of calendarEvents) {
      if (filter === "meetings") continue
      if (filter === "lease_renewals" && !e.eventKind.startsWith("lease_"))
        continue
      if (filter === "follow_ups" && e.eventKind !== "follow_up") continue

      const c = colorFor(e.eventKind)
      const dimmed = e.status !== "upcoming"
      list.push({
        id: `e:${e.id}`,
        title: e.title,
        start: e.startDate,
        end: e.endDate ?? undefined,
        allDay: e.allDay,
        backgroundColor: c.bg,
        borderColor: c.border,
        textColor: "#ffffff",
        // Apply opacity directly so completed/dismissed rows visually fade
        // without removing them from the grid.
        classNames: dimmed ? ["opacity-50"] : undefined,
        extendedProps: {
          source: "calendar_event",
          recordId: e.id,
          kind: e.eventKind,
          status: e.status,
        },
      })
    }

    return list
  }, [filter, meetings, calendarEvents])

  function handleEventClick({
    event,
    jsEvent,
  }: {
    event: EventImpl
    jsEvent: MouseEvent
  }) {
    jsEvent.preventDefault()
    const source = event.extendedProps.source as string | undefined
    const recordId = event.extendedProps.recordId as string | undefined
    if (!recordId) return
    if (source === "meeting") {
      const m = meetingMap.get(recordId)
      if (m) setDrawerSubject({ kind: "meeting", meeting: m })
    } else if (source === "calendar_event") {
      const e = eventMap.get(recordId)
      if (e) setDrawerSubject({ kind: "calendar_event", event: e })
    }
  }

  return (
    <div className="grid gap-4">
      {/* Filter chips */}
      <div className="flex flex-wrap items-center gap-2">
        {FILTERS.map((key) => (
          <button
            key={key}
            type="button"
            onClick={() => setFilter(key)}
            className={cn(
              "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
              filter === key
                ? "border-primary bg-primary/10 text-primary"
                : "text-muted-foreground hover:border-primary/40"
            )}
          >
            {FILTER_LABELS[key]}
          </button>
        ))}

        {/* Color legend */}
        <div className="ms-auto flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
          <LegendDot color={EVENT_KIND_COLORS.meeting.bg} label="Meetings" />
          <LegendDot
            color={EVENT_KIND_COLORS.lease_renewal.bg}
            label="Lease renewal"
          />
          <LegendDot
            color={EVENT_KIND_COLORS.lease_renewal_outreach.bg}
            label="Renewal due"
          />
          <LegendDot color={EVENT_KIND_COLORS.follow_up.bg} label="Follow-up" />
          <LegendDot
            color={EVENT_KIND_COLORS.anniversary.bg}
            label="Anniversary"
          />
        </div>
      </div>

      <div className="rounded-lg border bg-card p-4">
        <FullCalendar
          direction={direction}
          plugins={[dayGridPlugin, interactionPlugin, multiMonthPlugin]}
          initialView="dayGridMonth"
          eventDisplay="block"
          events={events}
          headerToolbar={{
            start: "prev,next today",
            center: "title",
            end: "multiMonthYear,dayGridMonth,dayGridWeek",
          }}
          views={{
            multiMonthYear: {
              buttonText: "Year",
              multiMonthMaxColumns: 3,
            },
          }}
          eventClick={handleEventClick}
          dayMaxEvents={3}
          height="auto"
          firstDay={0}
        />
      </div>

      <EventDetailDrawer
        lang={lang}
        subject={drawerSubject}
        onOpenChange={(open) => {
          if (!open) setDrawerSubject(null)
        }}
        onStatusChanged={(eventId, newStatus) => {
          // Optimistic — patch the local map so the drawer (and re-renders)
          // reflect the new state without a round-trip back to the server.
          const existing = eventMap.get(eventId)
          if (existing) {
            existing.status = newStatus
          }
          setDrawerSubject(null)
        }}
      />
    </div>
  )
}

function LegendDot({ color, label }: { color: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span
        className="size-2 rounded-full"
        style={{ backgroundColor: color }}
        aria-hidden="true"
      />
      {label}
    </span>
  )
}
