"use client"

import { useMemo, useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import {
  Check,
  LinkIcon,
  Loader2,
  Pause,
  SearchCheck,
  ThumbsDown,
  UserX,
} from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"

// Human-readable labels for toast messages and screen-reader feedback. Kept
// in sync with the action strings the API route accepts in its ACTIONS set.
const ACTION_LABELS: Record<string, string> = {
  approve_create_contact: "Approve Contact",
  approve_link_contact: "Link Contact",
  needs_more_evidence: "Needs Evidence",
  snooze: "Snooze",
  reject: "Reject",
  not_a_contact: "Not a Contact",
}

type ContactChoice = {
  id: string
  name: string
  company: string | null
  email: string | null
}

type CandidateActionsProps = {
  candidateId: string
  contacts: ContactChoice[]
  preferredContactId?: string | null
  hasMatchingContact: boolean
}

export function CandidateActions({
  candidateId,
  contacts,
  preferredContactId,
  hasMatchingContact,
}: CandidateActionsProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  // Track which specific action is in flight so the right button can show a
  // spinner while the other buttons disable. Without this, users get no
  // visible feedback during the 1-3s server roundtrip and assume the click
  // did nothing — which is exactly the bug they reported.
  const [pendingAction, setPendingAction] = useState<string | null>(null)
  // Only pre-select when there's an actual matching Contact. Otherwise leave
  // the dropdown empty so an arbitrary alphabetical-first contact isn't
  // mistaken for a system suggestion.
  const [contactId, setContactId] = useState(
    hasMatchingContact ? (preferredContactId ?? "") : ""
  )
  const [reason, setReason] = useState("")
  const [error, setError] = useState<string | null>(null)

  const contactOptions = useMemo(
    () =>
      contacts.map((contact) => ({
        ...contact,
        label: [contact.name, contact.company, contact.email]
          .filter(Boolean)
          .join(" - "),
      })),
    [contacts]
  )

  function runAction(action: string, body: Record<string, unknown> = {}) {
    setError(null)
    setPendingAction(action)
    startTransition(async () => {
      try {
        const response = await fetch(
          `/api/contact-promotion-candidates/${candidateId}/actions`,
          {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ action, ...body }),
          }
        )
        if (!response.ok) {
          const payload = (await response.json().catch(() => null)) as {
            error?: string
          } | null
          const message = payload?.error ?? "Action failed"
          setError(message)
          toast.error(`${ACTION_LABELS[action] ?? action} failed: ${message}`)
          return
        }
        toast.success(`${ACTION_LABELS[action] ?? action} applied`)
        window.dispatchEvent(new Event("contact-candidates-changed"))
        router.refresh()
      } finally {
        setPendingAction(null)
      }
    })
  }

  return (
    <div className="grid gap-3 rounded-md border bg-muted/20 p-3">
      <div>
        <p className="text-sm font-medium">Review decision</p>
        <p className="text-xs text-muted-foreground">
          Approving creates or links the Contact, then it can be worked from
          Leads.
        </p>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button
          size="sm"
          disabled={isPending}
          onClick={() => runAction("approve_create_contact")}
        >
          {pendingAction === "approve_create_contact" ? (
            <Loader2 className="me-2 size-4 animate-spin" />
          ) : (
            <Check className="me-2 size-4" />
          )}
          Approve Contact
        </Button>
        <Button
          size="sm"
          variant="secondary"
          disabled={isPending}
          onClick={() => runAction("needs_more_evidence")}
        >
          {pendingAction === "needs_more_evidence" ? (
            <Loader2 className="me-2 size-4 animate-spin" />
          ) : (
            <SearchCheck className="me-2 size-4" />
          )}
          Needs Evidence
        </Button>
        <Button
          size="sm"
          variant="outline"
          disabled={isPending}
          onClick={() =>
            runAction("snooze", {
              snoozedUntil: new Date(Date.now() + 7 * 86_400_000).toISOString(),
            })
          }
        >
          {pendingAction === "snooze" ? (
            <Loader2 className="me-2 size-4 animate-spin" />
          ) : (
            <Pause className="me-2 size-4" />
          )}
          Snooze
        </Button>
      </div>

      <div className="grid gap-2">
        {!hasMatchingContact ? (
          <p className="text-xs text-muted-foreground">
            No existing Contact matches this email or phone. Use{" "}
            <span className="font-medium">Approve Contact</span> to create a new
            one, or pick an existing Contact below to link to.
          </p>
        ) : null}
        <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto]">
          <Select value={contactId} onValueChange={setContactId}>
            <SelectTrigger aria-label="Contact to link">
              <SelectValue placeholder="Choose an existing Contact" />
            </SelectTrigger>
            <SelectContent>
              {contactOptions.map((contact) => (
                <SelectItem key={contact.id} value={contact.id}>
                  {contact.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            size="sm"
            variant="outline"
            disabled={isPending || !contactId}
            onClick={() =>
              runAction("approve_link_contact", {
                contactId,
                reason: "Linked from candidate review.",
              })
            }
          >
            {pendingAction === "approve_link_contact" ? (
              <Loader2 className="me-2 size-4 animate-spin" />
            ) : (
              <LinkIcon className="me-2 size-4" />
            )}
            Link Contact
          </Button>
        </div>
      </div>

      <div className="grid gap-2">
        <Textarea
          value={reason}
          onChange={(event) => setReason(event.target.value)}
          placeholder="Review note"
          rows={2}
        />
        <div className="flex flex-wrap gap-2">
          <Button
            size="sm"
            variant="outline"
            disabled={isPending}
            onClick={() => runAction("reject", { reason })}
          >
            {pendingAction === "reject" ? (
              <Loader2 className="me-2 size-4 animate-spin" />
            ) : (
              <ThumbsDown className="me-2 size-4" />
            )}
            Reject
          </Button>
          <Button
            size="sm"
            variant="destructive"
            disabled={isPending}
            onClick={() => runAction("not_a_contact", { reason })}
          >
            {pendingAction === "not_a_contact" ? (
              <Loader2 className="me-2 size-4 animate-spin" />
            ) : (
              <UserX className="me-2 size-4" />
            )}
            Not a Contact
          </Button>
        </div>
      </div>

      {error ? (
        <p
          role="alert"
          className="rounded-md border border-destructive/50 bg-destructive/10 px-2 py-1 text-xs font-medium text-destructive"
        >
          {error}
        </p>
      ) : null}
    </div>
  )
}
