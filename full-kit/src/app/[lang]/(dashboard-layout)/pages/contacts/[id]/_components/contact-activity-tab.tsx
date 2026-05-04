"use client"

import { useEffect, useRef, useState } from "react"
import { format } from "date-fns"
import { Calendar } from "lucide-react"

import type { ReactNode } from "react"
import type { CommRow } from "./contact-comm-row"

import { Card, CardContent } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { renderCommRow } from "./contact-comm-row"

interface Props {
  contactId: string
  lang: string
}

// Why this is a client component:
//
// Previously this was an async server component awaited inline in
// `page.tsx` — which meant the contact's 200 communications were fetched
// on EVERY page load, even when the user only opened Overview. Now we
// fetch from `/api/contacts/[id]/activity` from the client on mount.
//
// Radix `<TabsContent>` unmounts non-active tabs after hydration, so this
// component only mounts once the user clicks the Activity tab. The
// `useEffect` therefore only fires the fetch when the tab actually opens.

export function ContactActivityTabFallback() {
  return (
    <Card>
      <CardContent className="space-y-2 p-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-6 w-full" />
        ))}
      </CardContent>
    </Card>
  )
}

type MeetingRow = {
  id: string
  title: string
  date: Date
  location: string | null
}

type ActivityEvent =
  | { kind: "comm"; date: Date; comm: CommRow }
  | { kind: "meeting"; date: Date; meeting: MeetingRow }

// API response (dates come over the wire as ISO strings; we revive Date
// objects on parse so downstream renderers stay simple).
type ActivityApiResponse = {
  comms: Array<Omit<CommRow, "date"> & { date: string }>
  totalCommCount: number
  meetings: Array<Omit<MeetingRow, "date"> & { date: string }>
}

function buildActivityFeed(
  comms: CommRow[],
  meetings: MeetingRow[]
): ActivityEvent[] {
  const events: ActivityEvent[] = [
    ...comms.map((comm) => ({ kind: "comm" as const, date: comm.date, comm })),
    ...meetings.map((meeting) => ({
      kind: "meeting" as const,
      date: meeting.date,
      meeting,
    })),
  ]
  events.sort((a, b) => {
    const dt = b.date.getTime() - a.date.getTime()
    if (dt !== 0) return dt
    const idA = a.kind === "comm" ? a.comm.id : a.meeting.id
    const idB = b.kind === "comm" ? b.comm.id : b.meeting.id
    return idA.localeCompare(idB)
  })
  return events
}

function renderActivityEvent(event: ActivityEvent, lang: string): ReactNode {
  if (event.kind === "comm") {
    return (
      <div
        key={`comm:${event.comm.id}`}
        className="border-b py-2 last:border-b-0"
      >
        {renderCommRow(event.comm, lang)}
      </div>
    )
  }
  return (
    <div
      key={`meeting:${event.meeting.id}`}
      className="flex items-center gap-2 border-b py-2 text-sm last:border-b-0"
    >
      <Calendar className="size-4 shrink-0 text-amber-500" />
      <span className="flex-1 truncate font-medium">{event.meeting.title}</span>
      {event.meeting.location ? (
        <span className="shrink-0 text-xs text-muted-foreground">
          {event.meeting.location}
        </span>
      ) : null}
      <span className="shrink-0 text-xs text-muted-foreground">
        {format(event.meeting.date, "MMM d, yyyy h:mm a")}
      </span>
    </div>
  )
}

type LoadState =
  | { status: "idle" }
  | { status: "loading" }
  | {
      status: "loaded"
      comms: CommRow[]
      totalCommCount: number
      meetings: MeetingRow[]
    }
  | { status: "error"; error: string }

export function ContactActivityTab({ contactId, lang }: Props) {
  const [state, setState] = useState<LoadState>({ status: "idle" })
  // Track whether we've ever fired the fetch so StrictMode's double-effect
  // in dev doesn't fire two requests. The abort below handles the same
  // issue for the in-flight case.
  const startedRef = useRef(false)

  useEffect(() => {
    if (startedRef.current) return
    startedRef.current = true

    const ac = new AbortController()
    setState({ status: "loading" })
    void (async () => {
      try {
        const res = await fetch(`/api/contacts/${contactId}/activity`, {
          signal: ac.signal,
          cache: "no-store",
        })
        if (!res.ok) {
          throw new Error(`Activity fetch failed (${res.status})`)
        }
        const json = (await res.json()) as ActivityApiResponse
        setState({
          status: "loaded",
          totalCommCount: json.totalCommCount,
          comms: json.comms.map((c) => ({ ...c, date: new Date(c.date) })),
          meetings: json.meetings.map((m) => ({ ...m, date: new Date(m.date) })),
        })
      } catch (err) {
        if (ac.signal.aborted) return
        // Reset startedRef so a tab toggle can retry once the user clicks
        // away and back. Cheap retry path without a dedicated button.
        startedRef.current = false
        setState({
          status: "error",
          error: err instanceof Error ? err.message : "Unknown error",
        })
      }
    })()

    return () => ac.abort()
  }, [contactId])

  if (state.status === "idle" || state.status === "loading") {
    return <ContactActivityTabFallback />
  }

  if (state.status === "error") {
    return (
      <Card>
        <CardContent className="space-y-2 p-4 text-sm">
          <p className="font-medium text-red-700">Couldn&apos;t load activity.</p>
          <p className="text-muted-foreground">{state.error}</p>
        </CardContent>
      </Card>
    )
  }

  const { comms, totalCommCount, meetings } = state
  const totalActivity = totalCommCount + meetings.length
  const commsTruncated = totalCommCount > comms.length

  if (totalActivity === 0) {
    return (
      <p className="text-muted-foreground text-sm py-4">
        No activity recorded for this contact yet.
      </p>
    )
  }

  return (
    <Card>
      <CardContent className="space-y-1 p-4">
        {commsTruncated ? (
          <p className="mb-2 rounded-md border bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
            Showing latest {comms.length} communications of {totalCommCount}{" "}
            total. Older communications are not rendered.
          </p>
        ) : null}
        {buildActivityFeed(comms, meetings).map((event) =>
          renderActivityEvent(event, lang)
        )}
      </CardContent>
    </Card>
  )
}
