"use client"

import { useMemo, useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import {
  Check,
  LinkIcon,
  Pause,
  SearchCheck,
  ThumbsDown,
  UserX,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"

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
    startTransition(async () => {
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
        setError(payload?.error ?? "Action failed")
        return
      }
      window.dispatchEvent(new Event("contact-candidates-changed"))
      router.refresh()
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
          <Check className="me-2 size-4" />
          Approve Contact
        </Button>
        <Button
          size="sm"
          variant="secondary"
          disabled={isPending}
          onClick={() => runAction("needs_more_evidence")}
        >
          <SearchCheck className="me-2 size-4" />
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
          <Pause className="me-2 size-4" />
          Snooze
        </Button>
      </div>

      <div className="grid gap-2">
        {!hasMatchingContact ? (
          <p className="text-xs text-muted-foreground">
            No existing Contact matches this email or phone. Use{" "}
            <span className="font-medium">Approve Contact</span> to create a
            new one, or pick an existing Contact below to link to.
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
            <LinkIcon className="me-2 size-4" />
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
            <ThumbsDown className="me-2 size-4" />
            Reject
          </Button>
          <Button
            size="sm"
            variant="destructive"
            disabled={isPending}
            onClick={() => runAction("not_a_contact", { reason })}
          >
            <UserX className="me-2 size-4" />
            Not a Contact
          </Button>
        </div>
      </div>

      {error ? <p className="text-xs text-destructive">{error}</p> : null}
    </div>
  )
}
