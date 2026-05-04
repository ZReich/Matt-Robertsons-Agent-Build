"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { toast } from "sonner"
import { Check, Pencil, Send, Sparkles, X } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { Textarea } from "@/components/ui/textarea"

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
            <RenewalReplyInline
              lang={lang}
              leaseRecordId={event.leaseRecordId}
            />
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
// Renewal reply inline preview — fetches the latest PendingReply tied to the
// LeaseRecord and renders the draft body inline with Send / Edit / Dismiss
// actions. Mirrors the leads-page pattern (see GenerateAutoReply) so the user
// never has to leave the calendar to act on a draft.
// =============================================================================

interface InlinePendingReply {
  id: string
  status: string
  draftSubject: string
  draftBody: string
  contactId: string | null
  property: {
    id: string
    name: string | null
    address: string
  } | null
}

function RenewalReplyInline({
  lang,
  leaseRecordId,
}: {
  lang: string
  leaseRecordId: string
}) {
  const [loading, setLoading] = useState(true)
  const [reply, setReply] = useState<InlinePendingReply | null>(null)
  const [error, setError] = useState<string | null>(null)

  // Editable buffers (only used while editing).
  const [editing, setEditing] = useState(false)
  const [subject, setSubject] = useState("")
  const [body, setBody] = useState("")
  const [busy, setBusy] = useState<"send" | "dismiss" | "save" | null>(null)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)
    fetch(
      `/api/pending-replies?leaseRecordId=${encodeURIComponent(leaseRecordId)}`
    )
      .then(async (res) => {
        if (!res.ok) throw new Error(`fetch failed (${res.status})`)
        const json = (await res.json()) as { replies: InlinePendingReply[] }
        if (cancelled) return
        // Prefer the most recent pending draft; fall back to the most recent of
        // any status (so users see history instead of an empty UI).
        const pending = json.replies.find((r) => r.status === "pending")
        const chosen = pending ?? json.replies[0] ?? null
        setReply(chosen)
        if (chosen) {
          setSubject(chosen.draftSubject)
          setBody(chosen.draftBody)
        }
      })
      .catch((e: unknown) => {
        if (cancelled) return
        setError(e instanceof Error ? e.message : "fetch failed")
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [leaseRecordId])

  async function patch(
    action: "edit" | "send" | "dismiss",
    extra: Record<string, unknown> = {}
  ): Promise<boolean> {
    if (!reply) return false
    const res = await fetch(`/api/pending-replies/${reply.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, ...extra }),
    })
    const json = (await res.json()) as {
      ok?: boolean
      error?: string
      details?: string
    }
    if (!res.ok || !json.ok) {
      const detail = json.details ? ` — ${json.details.slice(0, 200)}` : ""
      toast.error(`${json.error ?? action + " failed"}${detail}`)
      return false
    }
    return true
  }

  async function saveEdits() {
    if (!reply) return
    setBusy("save")
    try {
      const ok = await patch("edit", { draftSubject: subject, draftBody: body })
      if (ok) {
        toast.success("Draft updated")
        setReply({ ...reply, draftSubject: subject, draftBody: body })
        setEditing(false)
      }
    } finally {
      setBusy(null)
    }
  }

  async function send() {
    if (!reply) return
    if (
      !window.confirm(
        "Send this re-engagement email now from Matt's mailbox via Microsoft Graph?"
      )
    )
      return
    setBusy("send")
    try {
      // If editing, persist edits first so the sent body matches what's on screen.
      if (editing && (subject !== reply.draftSubject || body !== reply.draftBody)) {
        const editOk = await patch("edit", {
          draftSubject: subject,
          draftBody: body,
        })
        if (!editOk) return
      }
      const ok = await patch("send")
      if (ok) {
        toast.success("Sent")
        setReply({ ...reply, status: "approved" })
        setEditing(false)
      }
    } finally {
      setBusy(null)
    }
  }

  async function dismiss() {
    if (!reply) return
    const reason = window.prompt("Dismiss reason (optional)") ?? ""
    setBusy("dismiss")
    try {
      const ok = await patch("dismiss", { dismissReason: reason })
      if (ok) {
        toast.success("Dismissed")
        setReply({ ...reply, status: "dismissed" })
        setEditing(false)
      }
    } finally {
      setBusy(null)
    }
  }

  if (loading) {
    return (
      <div className="rounded-md border border-amber-300 bg-amber-50 p-3 text-xs text-amber-900 dark:border-amber-700 dark:bg-amber-950 dark:text-amber-200">
        Loading drafted reply…
      </div>
    )
  }

  if (error) {
    return (
      <div className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-xs text-destructive">
        Could not load drafted reply: {error}
      </div>
    )
  }

  if (!reply) {
    return (
      <div className="rounded-md border border-dashed bg-muted/30 p-3 text-xs text-muted-foreground">
        No draft has been generated for this lease yet.
      </div>
    )
  }

  const isPending = reply.status === "pending"

  return (
    <div className="rounded-md border border-amber-300 bg-amber-50 p-3 text-amber-900 dark:border-amber-700 dark:bg-amber-950 dark:text-amber-200">
      <div className="flex items-center justify-between gap-2">
        <p className="flex items-center gap-1 text-sm font-medium">
          <Sparkles className="size-4" /> Auto-drafted re-engagement
        </p>
        <Badge variant="outline" className="capitalize">
          {reply.status}
        </Badge>
      </div>

      <div className="mt-3 grid gap-2">
        {editing ? (
          <>
            <div>
              <label className="mb-1 block text-xs font-medium">Subject</label>
              <Input
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                disabled={busy !== null}
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium">Body</label>
              <Textarea
                value={body}
                onChange={(e) => setBody(e.target.value)}
                rows={12}
                disabled={busy !== null}
                className="font-mono text-xs"
              />
            </div>
          </>
        ) : (
          <>
            <div>
              <p className="text-xs font-medium opacity-70">Subject</p>
              <p className="text-sm font-medium">{reply.draftSubject}</p>
            </div>
            <div>
              <p className="mb-1 text-xs font-medium opacity-70">Body</p>
              <pre className="max-h-72 overflow-y-auto whitespace-pre-wrap rounded border border-amber-200 bg-white/60 p-2 text-xs font-sans text-amber-950 dark:border-amber-800 dark:bg-black/30 dark:text-amber-100">
                {reply.draftBody}
              </pre>
            </div>
          </>
        )}
      </div>

      {isPending ? (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          {editing ? (
            <>
              <Button
                size="sm"
                variant="default"
                onClick={saveEdits}
                disabled={busy !== null}
              >
                {busy === "save" ? "Saving…" : "Save edits"}
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  setEditing(false)
                  setSubject(reply.draftSubject)
                  setBody(reply.draftBody)
                }}
                disabled={busy !== null}
              >
                Cancel
              </Button>
            </>
          ) : (
            <Button
              size="sm"
              variant="outline"
              onClick={() => setEditing(true)}
              disabled={busy !== null}
            >
              <Pencil className="mr-1 size-4" /> Edit
            </Button>
          )}
          <div className="ml-auto flex items-center gap-2">
            <Button
              size="sm"
              variant="ghost"
              onClick={dismiss}
              disabled={busy !== null}
            >
              <X className="mr-1 size-4" />
              {busy === "dismiss" ? "Dismissing…" : "Dismiss"}
            </Button>
            <Button
              size="sm"
              variant="default"
              onClick={send}
              disabled={busy !== null}
            >
              {busy === "send" ? (
                "Sending…"
              ) : (
                <>
                  <Send className="mr-1 size-4" /> Send
                </>
              )}
            </Button>
          </div>
        </div>
      ) : (
        <p className="mt-3 text-xs opacity-70">
          {reply.status === "approved" ? (
            <>
              <Check className="me-1 inline size-3" /> Already actioned. Open the{" "}
              <Link
                href={`/${lang}/pages/pending-replies?leaseRecordId=${encodeURIComponent(leaseRecordId)}`}
                className="underline"
              >
                full history
              </Link>
              .
            </>
          ) : (
            <>
              Dismissed. Open the{" "}
              <Link
                href={`/${lang}/pages/pending-replies?leaseRecordId=${encodeURIComponent(leaseRecordId)}`}
                className="underline"
              >
                full history
              </Link>
              .
            </>
          )}
        </p>
      )}
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
