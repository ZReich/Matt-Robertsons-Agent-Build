"use client"

import { useState } from "react"
import Link from "next/link"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"

import type {
  CalendarEventDTO,
  CalendarMeetingDTO,
} from "./calendar-grid"

export type DrawerSubject =
  | { kind: "meeting"; meeting: CalendarMeetingDTO }
  | { kind: "calendar_event"; event: CalendarEventDTO }

interface Props {
  lang: string
  subject: DrawerSubject | null
  onOpenChange: (open: boolean) => void
  onStatusChanged?: (eventId: string, newStatus: string) => void
}

const KIND_LABELS: Record<string, string> = {
  meeting: "Meeting",
  lease_renewal: "Lease renewal",
  lease_renewal_outreach: "Renewal outreach",
  follow_up: "Follow-up",
  anniversary: "Anniversary",
}

function kindLabel(kind: string): string {
  return KIND_LABELS[kind] ?? kind.replace(/_/g, " ")
}

export function EventDetailDrawer({
  lang,
  subject,
  onOpenChange,
  onStatusChanged,
}: Props) {
  return (
    <Sheet open={subject !== null} onOpenChange={onOpenChange}>
      <SheetContent
        side="end"
        className="w-full sm:max-w-md overflow-y-auto p-6"
      >
        {subject?.kind === "meeting" ? (
          <MeetingBody lang={lang} meeting={subject.meeting} />
        ) : subject?.kind === "calendar_event" ? (
          <CalendarEventBody
            lang={lang}
            event={subject.event}
            onStatusChanged={onStatusChanged}
          />
        ) : null}
      </SheetContent>
    </Sheet>
  )
}

// =============================================================================
// Meeting body
// =============================================================================

function MeetingBody({
  lang,
  meeting,
}: {
  lang: string
  meeting: CalendarMeetingDTO
}) {
  const start = new Date(meeting.date)
  const end = meeting.endDate ? new Date(meeting.endDate) : null
  return (
    <>
      <SheetHeader>
        <div className="flex items-center gap-2">
          <Badge variant="default">Meeting</Badge>
          <Badge variant="outline" className="capitalize">
            {meeting.category}
          </Badge>
        </div>
        <SheetTitle>{meeting.title}</SheetTitle>
        <SheetDescription>
          {formatDateTime(start)}
          {end && ` — ${formatDateTime(end)}`}
        </SheetDescription>
      </SheetHeader>

      <div className="mt-6 grid gap-4 text-sm">
        {meeting.location && (
          <Field label="Location">
            <span>{meeting.location}</span>
          </Field>
        )}

        {meeting.attendees.length > 0 && (
          <Field label="Attendees">
            <ul className="grid gap-1">
              {meeting.attendees.map((a) =>
                a.contact ? (
                  <li key={a.id}>
                    <Link
                      href={`/${lang}/pages/contacts/${a.contact.id}`}
                      className="text-primary hover:underline"
                    >
                      {a.contact.name}
                    </Link>
                    {a.role && (
                      <span className="ms-2 text-muted-foreground">
                        ({a.role})
                      </span>
                    )}
                  </li>
                ) : null
              )}
            </ul>
          </Field>
        )}

        {meeting.deal && (
          <Field label="Deal">
            <Link
              href={`/${lang}/pages/deals`}
              className="text-primary hover:underline"
            >
              {meeting.deal.name}
            </Link>
          </Field>
        )}

        {meeting.notes && (
          <Field label="Notes">
            <p className="whitespace-pre-wrap text-muted-foreground">
              {meeting.notes}
            </p>
          </Field>
        )}
      </div>
    </>
  )
}

// =============================================================================
// CalendarEvent body — the system-generated rows (lease renewals, follow-ups,
// anniversaries). These have a status that the drawer can mutate.
// =============================================================================

function CalendarEventBody({
  lang,
  event,
  onStatusChanged,
}: {
  lang: string
  event: CalendarEventDTO
  onStatusChanged?: (eventId: string, newStatus: string) => void
}) {
  const [status, setStatus] = useState(event.status)
  const [busy, setBusy] = useState<"complete" | "dismiss" | null>(null)
  const [error, setError] = useState<string | null>(null)

  const startDate = new Date(event.startDate)
  const isLeaseEvent = event.eventKind.startsWith("lease_")

  async function patchStatus(newStatus: "completed" | "dismissed") {
    setBusy(newStatus === "completed" ? "complete" : "dismiss")
    setError(null)
    try {
      const res = await fetch(`/api/calendar/events/${event.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      })
      if (!res.ok) {
        const j = (await res.json().catch(() => ({}))) as { error?: string }
        throw new Error(j.error ?? `request failed (${res.status})`)
      }
      setStatus(newStatus)
      onStatusChanged?.(event.id, newStatus)
    } catch (err) {
      setError(err instanceof Error ? err.message : "update failed")
    } finally {
      setBusy(null)
    }
  }

  return (
    <>
      <SheetHeader>
        <div className="flex items-center gap-2">
          <Badge
            variant={
              event.eventKind === "lease_renewal_outreach"
                ? "destructive"
                : "secondary"
            }
          >
            {kindLabel(event.eventKind)}
          </Badge>
          <Badge variant="outline" className="capitalize">
            {status}
          </Badge>
        </div>
        <SheetTitle>{event.title}</SheetTitle>
        <SheetDescription>{formatDateTime(startDate)}</SheetDescription>
      </SheetHeader>

      <div className="mt-6 grid gap-4 text-sm">
        {event.description && (
          <Field label="Details">
            <p className="whitespace-pre-wrap text-muted-foreground">
              {event.description}
            </p>
          </Field>
        )}

        {event.contact && (
          <Field label="Contact">
            <Link
              href={`/${lang}/pages/contacts/${event.contact.id}`}
              className="text-primary hover:underline"
            >
              {event.contact.name}
            </Link>
          </Field>
        )}

        {event.property && (
          <Field label="Property">
            <Link
              href={`/${lang}/pages/properties/${event.property.id}`}
              className="text-primary hover:underline"
            >
              {event.property.name ?? event.property.address}
            </Link>
          </Field>
        )}

        {event.deal && (
          <Field label="Deal">
            <Link
              href={`/${lang}/pages/deals`}
              className="text-primary hover:underline"
            >
              {event.deal.name}
            </Link>
          </Field>
        )}

        {isLeaseEvent && event.leaseRecord && (
          <Field label="Lease summary">
            <ul className="grid gap-1 text-muted-foreground">
              {event.leaseRecord.leaseStartDate && (
                <li>
                  Term:{" "}
                  {formatDate(new Date(event.leaseRecord.leaseStartDate))}
                  {event.leaseRecord.leaseEndDate &&
                    ` → ${formatDate(new Date(event.leaseRecord.leaseEndDate))}`}
                  {event.leaseRecord.leaseTermMonths != null &&
                    ` (${event.leaseRecord.leaseTermMonths} mo)`}
                </li>
              )}
              {event.leaseRecord.rentAmount && (
                <li>
                  Rent: ${event.leaseRecord.rentAmount}
                  {event.leaseRecord.rentPeriod &&
                    ` / ${event.leaseRecord.rentPeriod}`}
                </li>
              )}
              {event.leaseRecord.mattRepresented && (
                <li>
                  Matt represented:{" "}
                  <span className="capitalize">
                    {event.leaseRecord.mattRepresented}
                  </span>
                </li>
              )}
              <li>
                Status:{" "}
                <span className="capitalize">{event.leaseRecord.status}</span>
              </li>
            </ul>
          </Field>
        )}

        {event.eventKind === "lease_renewal_outreach" &&
          event.leaseRecordId && (
            <RenewalReplyLink lang={lang} leaseRecordId={event.leaseRecordId} />
          )}

        {error && (
          <p className="rounded-md bg-destructive/10 px-3 py-2 text-xs text-destructive">
            {error}
          </p>
        )}
      </div>

      <SheetFooter className="mt-6">
        <Button
          variant="outline"
          disabled={busy !== null || status === "dismissed"}
          onClick={() => patchStatus("dismissed")}
        >
          {busy === "dismiss" ? "Dismissing..." : "Dismiss"}
        </Button>
        <Button
          disabled={busy !== null || status === "completed"}
          onClick={() => patchStatus("completed")}
        >
          {busy === "complete" ? "Marking..." : "Mark complete"}
        </Button>
      </SheetFooter>
    </>
  )
}

// =============================================================================
// Renewal reply quick-link — fetches the LeaseRecord's renewalReplies on
// demand and surfaces a button. We do this client-side so page.tsx doesn't
// have to pre-fetch every renewal draft for every event.
// =============================================================================

function RenewalReplyLink({
  lang,
  leaseRecordId,
}: {
  lang: string
  leaseRecordId: string
}) {
  // The plan calls for navigating to /pages/pending-replies/{id}, but that
  // detail page is a future stream. For now we link to the listing filtered
  // by the lease record (the listing route already exists at
  // /pages/pending-replies and supports a status query param). When
  // PendingReply detail pages ship we'll swap this to a direct link.
  const href = `/${lang}/pages/pending-replies?leaseRecordId=${encodeURIComponent(leaseRecordId)}`
  return (
    <div className="rounded-md border border-amber-300 bg-amber-50 p-3 text-amber-900 dark:border-amber-700 dark:bg-amber-950 dark:text-amber-200">
      <p className="text-sm font-medium">Renewal outreach drafted</p>
      <p className="mt-1 text-xs">
        We&apos;ve drafted a re-engagement email tied to this lease.
      </p>
      <Button asChild size="sm" variant="default" className="mt-3">
        <Link href={href}>Open the auto-drafted reply</Link>
      </Button>
    </div>
  )
}

// =============================================================================
// Helpers
// =============================================================================

function Field({
  label,
  children,
}: {
  label: string
  children: React.ReactNode
}) {
  return (
    <div className="grid gap-1">
      <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </span>
      <div>{children}</div>
    </div>
  )
}

function formatDateTime(d: Date): string {
  return d.toLocaleString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  })
}

function formatDate(d: Date): string {
  return d.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  })
}
