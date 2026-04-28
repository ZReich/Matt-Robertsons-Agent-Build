"use client"

import { useMemo, useState } from "react"
import { format, isPast, isToday, isYesterday } from "date-fns"
import {
  ArrowDownLeft,
  ArrowUpRight,
  Calendar,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Circle,
  Clock,
  Mail,
  MessageSquare,
  Phone,
  Smartphone,
} from "lucide-react"

import type { TranscriptMatch } from "@/lib/transcript-matching"
import type {
  CommunicationMeta,
  MeetingMeta,
  TodoMeta,
  VaultNote,
} from "@/lib/vault/shared"
import type { ReactNode } from "react"

import { getExplicitAttachmentSummary } from "@/lib/communications/attachment-types"
import { parseSections } from "@/lib/parse-sections"
import { normalizeEntityRef } from "@/lib/vault/shared"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { MarkdownRenderer } from "@/components/ui/markdown-renderer"
import { AttachmentSummaryInline } from "@/components/communications/attachment-summary-inline"

// =============================================================================
// Types
// =============================================================================

export type ActivityEvent =
  | {
      type: "communication"
      date: Date
      data: VaultNote<CommunicationMeta>
    }
  | {
      type: "meeting"
      date: Date
      data: VaultNote<MeetingMeta>
      /** Auto-matched Plaud transcript for this meeting */
      transcript?: VaultNote<CommunicationMeta>
      matchConfidence?: "explicit" | "high" | "medium"
    }
  | {
      type: "todo"
      date: Date
      data: VaultNote<TodoMeta>
    }

type FilterType = "all" | "calls" | "emails" | "texts" | "meetings" | "todos"

// =============================================================================
// Channel config
// =============================================================================

const CHANNEL_ICONS: Record<string, ReactNode> = {
  call: <Phone className="size-3.5" />,
  email: <Mail className="size-3.5" />,
  text: <MessageSquare className="size-3.5" />,
  whatsapp: <Smartphone className="size-3.5" />,
  meeting: <Calendar className="size-3.5" />,
}

const DOT_COLORS: Record<string, string> = {
  call: "bg-green-500",
  email: "bg-blue-500",
  text: "bg-violet-500",
  whatsapp: "bg-teal-500",
  meeting: "bg-amber-500",
  todo: "bg-gray-400",
}

// =============================================================================
// Helpers
// =============================================================================

function dayLabel(dayKey: string): string {
  const d = new Date(dayKey + "T12:00:00")
  if (isToday(d)) return "Today"
  if (isYesterday(d)) return "Yesterday"
  return format(d, "MMMM d, yyyy")
}

function groupByDay(events: ActivityEvent[]): [string, ActivityEvent[]][] {
  const groups = new Map<string, ActivityEvent[]>()
  for (const event of events) {
    const day = format(event.date, "yyyy-MM-dd")
    const existing = groups.get(day) ?? []
    existing.push(event)
    groups.set(day, existing)
  }
  return Array.from(groups.entries())
}

// =============================================================================
// Filter Bar
// =============================================================================

interface ActivityFilterBarProps {
  active: FilterType
  onChange: (filter: FilterType) => void
  counts: Record<FilterType, number>
  overdueCount: number
}

function ActivityFilterBar({
  active,
  onChange,
  counts,
  overdueCount,
}: ActivityFilterBarProps) {
  const filters: { key: FilterType; label: string }[] = [
    { key: "all", label: "All" },
    { key: "calls", label: "Calls" },
    { key: "emails", label: "Emails" },
    { key: "texts", label: "Texts" },
    { key: "meetings", label: "Meetings" },
    { key: "todos", label: "Todos" },
  ]

  return (
    <div className="flex items-center gap-2 flex-wrap">
      {filters.map((f) => (
        <Button
          key={f.key}
          variant={active === f.key ? "default" : "outline"}
          size="sm"
          onClick={() => onChange(f.key)}
          className="h-7 text-xs"
        >
          {f.label}
          {counts[f.key] > 0 && (
            <span className="ml-1 opacity-70">{counts[f.key]}</span>
          )}
        </Button>
      ))}
      {overdueCount > 0 && (
        <Badge variant="destructive" className="text-xs">
          {overdueCount} overdue
        </Badge>
      )}
    </div>
  )
}

// =============================================================================
// Timeline Entry
// =============================================================================

function TimelineEntry({ event }: { event: ActivityEvent }) {
  const [expanded, setExpanded] = useState(false)

  if (event.type === "communication") {
    const comm = event.data
    const contactName = normalizeEntityRef(comm.meta.contact)
    const dealName = comm.meta.deal ? normalizeEntityRef(comm.meta.deal) : null
    const isInbound = comm.meta.direction !== "outbound"
    const hasContent = !!comm.content?.trim()
    const parsed = hasContent ? parseSections(comm.content) : null

    return (
      <div className="relative pl-8 pb-6">
        {/* Dot */}
        <div
          className={`absolute left-0 top-1 size-4 rounded-full border-2 border-background ${
            DOT_COLORS[comm.meta.channel] ?? DOT_COLORS.call
          }`}
        />
        {/* Line */}
        <div className="absolute left-[7px] top-5 bottom-0 w-px bg-border" />

        {/* Content */}
        <div className="space-y-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-medium">{contactName}</span>
            <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
              {CHANNEL_ICONS[comm.meta.channel]}
              {comm.meta.channel}
            </span>
            {comm.meta.direction && (
              <span
                className={`flex items-center gap-0.5 text-xs ${
                  isInbound ? "text-green-600" : "text-blue-600"
                }`}
              >
                {isInbound ? (
                  <ArrowDownLeft className="size-3" />
                ) : (
                  <ArrowUpRight className="size-3" />
                )}
              </span>
            )}
            {dealName && (
              <Badge variant="outline" className="text-[10px] py-0">
                {dealName}
              </Badge>
            )}
            <span className="text-[11px] text-muted-foreground ml-auto">
              {format(event.date, "h:mm a")}
            </span>
          </div>

          {comm.meta.subject && (
            <p className="text-sm text-muted-foreground">{comm.meta.subject}</p>
          )}

          <AttachmentSummaryInline
            summary={getExplicitAttachmentSummary(
              comm.meta.attachments,
              comm.meta.attachmentFetchStatus
            )}
          />

          {/* Inline summary if available */}
          {parsed?.summary && !expanded && (
            <p className="text-xs text-muted-foreground line-clamp-2 mt-1">
              {parsed.summary.replace(/[-*]\s+/g, "").substring(0, 200)}
            </p>
          )}

          {hasContent && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setExpanded(!expanded)}
              className="h-6 text-xs px-2 mt-1"
            >
              {expanded ? (
                <>
                  <ChevronUp className="size-3 mr-1" /> Collapse
                </>
              ) : (
                <>
                  <ChevronDown className="size-3 mr-1" /> View full content
                </>
              )}
            </Button>
          )}

          {expanded && hasContent && (
            <div className="mt-2 rounded-lg border p-4 bg-card">
              <MarkdownRenderer content={comm.content} size="compact" />
            </div>
          )}
        </div>
      </div>
    )
  }

  if (event.type === "meeting") {
    const meeting = event.data
    const transcript = event.transcript
    const isPastMeeting = isPast(event.date)

    return (
      <div className="relative pl-8 pb-6">
        <div
          className={`absolute left-0 top-1 size-4 rounded-full border-2 border-background ${DOT_COLORS.meeting}`}
        />
        <div className="absolute left-[7px] top-5 bottom-0 w-px bg-border" />

        <div className="space-y-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-medium">{meeting.meta.title}</span>
            <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
              <Calendar className="size-3" />
              meeting
            </span>
            {meeting.meta.deal && (
              <Badge variant="outline" className="text-[10px] py-0">
                {normalizeEntityRef(meeting.meta.deal)}
              </Badge>
            )}
            {isPastMeeting && (
              <Badge variant="secondary" className="text-[10px] py-0">
                Past
              </Badge>
            )}
            <span className="text-[11px] text-muted-foreground ml-auto">
              {format(event.date, "h:mm a")}
            </span>
          </div>

          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            {meeting.meta.location && <span>{meeting.meta.location}</span>}
            {meeting.meta.duration_minutes && (
              <span className="inline-flex items-center gap-1">
                <Clock className="size-3" />
                {meeting.meta.duration_minutes}m
              </span>
            )}
          </div>

          {/* Auto-matched Plaud transcript */}
          {transcript && (
            <div className="mt-2 rounded-lg border border-green-200 dark:border-green-900 bg-green-50 dark:bg-green-950/30 p-3">
              <div className="flex items-center gap-2 mb-2">
                <Phone className="size-3 text-green-600" />
                <span className="text-xs font-medium text-green-700 dark:text-green-400">
                  Plaud Transcript
                </span>
                {event.matchConfidence && (
                  <Badge
                    variant="outline"
                    className="text-[9px] py-0 border-green-300 text-green-600"
                  >
                    {event.matchConfidence} match
                  </Badge>
                )}
              </div>
              <MarkdownRenderer
                content={
                  parseSections(transcript.content).summary ??
                  transcript.content.substring(0, 500)
                }
                size="compact"
              />
            </div>
          )}
        </div>
      </div>
    )
  }

  // Todo
  const todo = event.data as VaultNote<TodoMeta>
  const isOverdue =
    todo.meta.due_date &&
    todo.meta.status !== "done" &&
    isPast(new Date(todo.meta.due_date))
  const isDone = todo.meta.status === "done"

  return (
    <div className="relative pl-8 pb-6">
      <div
        className={`absolute left-0 top-1 size-4 rounded-full border-2 border-background ${
          isDone ? "bg-green-500" : isOverdue ? "bg-red-500" : DOT_COLORS.todo
        }`}
      />
      <div className="absolute left-[7px] top-5 bottom-0 w-px bg-border" />

      <div className="flex items-center gap-2 flex-wrap">
        {isDone ? (
          <CheckCircle2 className="size-4 text-green-600 shrink-0" />
        ) : (
          <Circle
            className={`size-4 shrink-0 ${
              isOverdue ? "text-red-500" : "text-muted-foreground"
            }`}
          />
        )}
        <span
          className={`text-sm ${
            isDone ? "text-muted-foreground line-through" : ""
          } ${isOverdue ? "text-red-600 font-medium" : ""}`}
        >
          {todo.meta.title}
        </span>
        {todo.meta.priority &&
          ["urgent", "high"].includes(todo.meta.priority) && (
            <Badge variant="destructive" className="text-[10px] px-1 py-0">
              {todo.meta.priority}
            </Badge>
          )}
        {isOverdue && (
          <Badge variant="destructive" className="text-[10px] px-1 py-0">
            overdue
          </Badge>
        )}
        {todo.meta.due_date && (
          <span className="text-[11px] text-muted-foreground ml-auto">
            due {format(new Date(todo.meta.due_date), "MMM d")}
          </span>
        )}
      </div>
    </div>
  )
}

// =============================================================================
// Main Component
// =============================================================================

interface ActivityTimelineProps {
  communications: VaultNote<CommunicationMeta>[]
  meetings: VaultNote<MeetingMeta>[]
  todos: VaultNote<TodoMeta>[]
  /** Pre-computed transcript matches (from server, plain object for RSC serialization) */
  transcriptMatches?: Record<string, TranscriptMatch>
}

export function ActivityTimeline({
  communications,
  meetings,
  todos,
  transcriptMatches,
}: ActivityTimelineProps) {
  const [filter, setFilter] = useState<FilterType>("all")

  // Build unified event list
  const allEvents = useMemo<ActivityEvent[]>(() => {
    const events: ActivityEvent[] = []

    for (const comm of communications) {
      const commDate = new Date(comm.meta.date)
      if (Number.isNaN(commDate.getTime())) continue
      events.push({
        type: "communication",
        date: commDate,
        data: comm,
      })
    }

    for (const meeting of meetings) {
      const match = transcriptMatches?.[meeting.path]
      const meetingDate = new Date(meeting.meta.date)
      if (Number.isNaN(meetingDate.getTime())) continue
      events.push({
        type: "meeting",
        date: meetingDate,
        data: meeting,
        transcript: match?.transcript,
        matchConfidence: match?.confidence,
      })
    }

    for (const todo of todos) {
      const rawDate = todo.meta.due_date ?? todo.meta.created
      const todoDate = rawDate ? new Date(rawDate) : new Date()
      if (Number.isNaN(todoDate.getTime())) continue
      events.push({
        type: "todo",
        date: todoDate,
        data: todo,
      })
    }

    return events.sort((a, b) => b.date.getTime() - a.date.getTime())
  }, [communications, meetings, todos, transcriptMatches])

  // Counts
  const counts = useMemo(() => {
    const c: Record<FilterType, number> = {
      all: allEvents.length,
      calls: 0,
      emails: 0,
      texts: 0,
      meetings: 0,
      todos: 0,
    }
    for (const e of allEvents) {
      if (e.type === "communication") {
        if (e.data.meta.channel === "call") c.calls++
        else if (e.data.meta.channel === "email") c.emails++
        else if (
          e.data.meta.channel === "text" ||
          e.data.meta.channel === "whatsapp"
        )
          c.texts++
      } else if (e.type === "meeting") {
        c.meetings++
      } else {
        c.todos++
      }
    }
    return c
  }, [allEvents])

  // Overdue count
  const overdueCount = useMemo(
    () =>
      todos.filter(
        (t) =>
          t.meta.status !== "done" &&
          t.meta.due_date &&
          isPast(new Date(t.meta.due_date))
      ).length,
    [todos]
  )

  // Filter
  const filtered = useMemo(() => {
    if (filter === "all") return allEvents
    return allEvents.filter((e) => {
      if (filter === "calls")
        return e.type === "communication" && e.data.meta.channel === "call"
      if (filter === "emails")
        return e.type === "communication" && e.data.meta.channel === "email"
      if (filter === "texts")
        return (
          e.type === "communication" &&
          (e.data.meta.channel === "text" || e.data.meta.channel === "whatsapp")
        )
      if (filter === "meetings") return e.type === "meeting"
      if (filter === "todos") return e.type === "todo"
      return true
    })
  }, [allEvents, filter])

  const grouped = groupByDay(filtered)

  return (
    <div className="space-y-4">
      <ActivityFilterBar
        active={filter}
        onChange={setFilter}
        counts={counts}
        overdueCount={overdueCount}
      />

      {grouped.length === 0 ? (
        <p className="text-sm text-muted-foreground py-8 text-center">
          No activity matches this filter.
        </p>
      ) : (
        <div className="space-y-6">
          {grouped.map(([day, events]) => (
            <div key={day}>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
                {dayLabel(day)}
              </p>
              <div>
                {events.map((event) => (
                  <TimelineEntry
                    key={`${event.type}-${event.data.path}`}
                    event={event}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
