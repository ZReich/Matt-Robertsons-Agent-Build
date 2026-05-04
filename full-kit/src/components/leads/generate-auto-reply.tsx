"use client"

import { useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { Check, Clipboard, Send, Sparkles, X } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { Textarea } from "@/components/ui/textarea"

interface PropertyChoice {
  id: string
  name: string | null
  address: string
  status: string
}

interface ExistingReply {
  id: string
  status: string
  draftSubject: string
  createdAt: string
}

interface DraftPreview {
  pendingReplyId: string
  subject: string
  body: string
  reasoning: string | null
  suggestedProperties: Array<{
    propertyId: string
    address: string
    name: string | null
    score: number
  }>
}

export function GenerateAutoReply({
  contactId,
  contactEmail,
  lang,
  triggerCommunicationId,
  properties,
  existingReplies,
}: {
  contactId: string
  contactEmail?: string | null
  lang: string
  triggerCommunicationId?: string
  properties: PropertyChoice[]
  existingReplies: ExistingReply[]
}) {
  const router = useRouter()
  const [propertyId, setPropertyId] = useState<string | null>(
    properties[0]?.id ?? null
  )
  const [submitting, setSubmitting] = useState(false)
  const [draft, setDraft] = useState<DraftPreview | null>(null)
  const [editedSubject, setEditedSubject] = useState("")
  const [editedBody, setEditedBody] = useState("")

  function closeDrawer() {
    setDraft(null)
    setEditedSubject("")
    setEditedBody("")
  }

  async function generate(): Promise<DraftPreview | null> {
    if (!propertyId) {
      toast.error("Pick a property first")
      return null
    }
    setSubmitting(true)
    try {
      const res = await fetch("/api/pending-replies", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contactId,
          propertyId,
          triggerCommunicationId,
        }),
      })
      const json = (await res.json()) as {
        ok?: boolean
        pendingReplyId?: string
        draft?: {
          subject: string
          body: string
          reasoning: string
          suggestedProperties: Array<{
            propertyId: string
            address: string
            name: string | null
            score: number
            reasons: string[]
          }>
        }
        reason?: string
        details?: string
      }
      if (!res.ok || !json.ok || !json.pendingReplyId || !json.draft) {
        toast.error(
          `${json.reason ?? "error"}${json.details ? ": " + json.details : ""}`
        )
        return null
      }
      const preview: DraftPreview = {
        pendingReplyId: json.pendingReplyId,
        subject: json.draft.subject,
        body: json.draft.body,
        reasoning: json.draft.reasoning || null,
        suggestedProperties: json.draft.suggestedProperties.map((s) => ({
          propertyId: s.propertyId,
          address: s.address,
          name: s.name,
          score: s.score,
        })),
      }
      setDraft(preview)
      setEditedSubject(preview.subject)
      setEditedBody(preview.body)
      router.refresh()
      return preview
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Network error")
      return null
    } finally {
      setSubmitting(false)
    }
  }

  async function patchDraft(
    pendingReplyId: string,
    action: "edit" | "approve" | "send" | "dismiss",
    extra: Record<string, unknown> = {}
  ): Promise<boolean> {
    const res = await fetch(`/api/pending-replies/${pendingReplyId}`, {
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
      toast.error(
        `${json.error ?? action + " failed"}${json.details ? ": " + json.details.slice(0, 200) : ""}`
      )
      return false
    }
    return true
  }

  async function saveEdits(silent = false): Promise<boolean> {
    if (!draft) return false
    if (editedSubject === draft.subject && editedBody === draft.body) {
      return true // no changes; nothing to save
    }
    const ok = await patchDraft(draft.pendingReplyId, "edit", {
      draftSubject: editedSubject,
      draftBody: editedBody,
    })
    if (ok && !silent) toast.success("Edits saved")
    return ok
  }

  async function approve() {
    if (!draft) return
    setSubmitting(true)
    try {
      if (!(await saveEdits(true))) return
      const ok = await patchDraft(draft.pendingReplyId, "approve")
      if (ok) {
        toast.success(
          "Approved & logged — copy from Pending Replies to send manually"
        )
        closeDrawer()
        router.refresh()
      }
    } finally {
      setSubmitting(false)
    }
  }

  async function send() {
    if (!draft) return
    if (!contactEmail) {
      toast.error("No email on file for this contact — can't send")
      return
    }
    if (
      !window.confirm(
        `Send this reply now to ${contactEmail}?\n\nIt goes from Matt's mailbox via Microsoft Graph.`
      )
    )
      return
    setSubmitting(true)
    try {
      if (!(await saveEdits(true))) return
      const ok = await patchDraft(draft.pendingReplyId, "send")
      if (ok) {
        toast.success(`Sent to ${contactEmail}`)
        closeDrawer()
        router.refresh()
      }
    } finally {
      setSubmitting(false)
    }
  }

  async function dismiss() {
    if (!draft) return
    setSubmitting(true)
    try {
      const ok = await patchDraft(draft.pendingReplyId, "dismiss")
      if (ok) {
        toast.success("Dismissed")
        closeDrawer()
        router.refresh()
      }
    } finally {
      setSubmitting(false)
    }
  }

  async function copyToClipboard() {
    try {
      await navigator.clipboard.writeText(
        `Subject: ${editedSubject}\n\n${editedBody}`
      )
      toast.success("Copied to clipboard")
    } catch {
      toast.error(
        "Could not copy — your browser may have blocked clipboard access"
      )
    }
  }

  async function handleGenerate() {
    await generate()
  }

  return (
    <>
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
            <Sparkles className="size-4" /> Auto-reply draft
          </CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3">
          {properties.length === 0 ? (
            <p className="text-xs text-muted-foreground">
              No properties in the catalog yet.{" "}
              <Link
                href={`/${lang}/pages/properties/import`}
                className="underline-offset-2 hover:underline"
              >
                Import some
              </Link>{" "}
              and the AI can draft replies referencing them.
            </p>
          ) : (
            <>
              <p className="text-xs text-muted-foreground">
                Pick the property this lead is about. The AI will draft a reply
                — review it inline before deciding to send.
              </p>
              <Select
                value={propertyId ?? undefined}
                onValueChange={(v) => setPropertyId(v)}
              >
                <SelectTrigger className="text-xs">
                  <SelectValue placeholder="Pick a property" />
                </SelectTrigger>
                <SelectContent>
                  {properties.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name ? `${p.name} — ${p.address}` : p.address}
                      <span className="ml-1 text-xs capitalize text-muted-foreground">
                        ({p.status.replace(/_/g, " ")})
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                size="sm"
                onClick={handleGenerate}
                disabled={submitting || !propertyId}
              >
                <Sparkles className="mr-1 size-4" />
                {submitting && !draft ? "Drafting…" : "Generate draft"}
              </Button>
            </>
          )}

          {existingReplies.length > 0 ? (
            <div className="text-xs">
              <p className="mb-1 font-medium text-muted-foreground">
                Past drafts
              </p>
              <ul className="grid gap-1">
                {existingReplies.slice(0, 5).map((r) => (
                  <li
                    key={r.id}
                    className="flex items-center justify-between gap-2"
                  >
                    <Link
                      href={`/${lang}/pages/pending-replies?status=${r.status}`}
                      className="line-clamp-1 hover:underline"
                    >
                      {r.draftSubject}
                    </Link>
                    <Badge
                      variant={r.status === "pending" ? "default" : "outline"}
                      className="capitalize"
                    >
                      {r.status}
                    </Badge>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </CardContent>
      </Card>

      <Sheet
        open={!!draft}
        onOpenChange={(open) => {
          if (!open) closeDrawer()
        }}
      >
        <SheetContent
          side="right"
          className="w-full sm:max-w-[640px] overflow-y-auto p-0"
        >
          {draft ? (
            <div className="flex h-full flex-col">
              <SheetHeader className="border-b p-6">
                <SheetTitle>AI-drafted reply</SheetTitle>
                <SheetDescription>
                  Review, edit, then send via Matt&apos;s mailbox or save the
                  draft. Nothing has been sent yet.
                </SheetDescription>
              </SheetHeader>

              <div className="grid flex-1 gap-4 overflow-y-auto p-6">
                <div>
                  <label className="mb-1 block text-xs font-medium text-muted-foreground">
                    Subject
                  </label>
                  <Input
                    value={editedSubject}
                    onChange={(e) => setEditedSubject(e.target.value)}
                    disabled={submitting}
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-muted-foreground">
                    Body
                  </label>
                  <Textarea
                    rows={16}
                    value={editedBody}
                    onChange={(e) => setEditedBody(e.target.value)}
                    disabled={submitting}
                    className="font-mono text-sm leading-relaxed"
                  />
                </div>

                {draft.suggestedProperties.length > 0 ? (
                  <div className="rounded-md border bg-muted/30 p-3 text-xs">
                    <p className="mb-1 font-medium">
                      Cross-references mentioned (
                      {draft.suggestedProperties.length})
                    </p>
                    <ul className="grid gap-1">
                      {draft.suggestedProperties.map((s) => (
                        <li
                          key={s.propertyId}
                          className="flex items-center justify-between"
                        >
                          <Link
                            href={`/${lang}/pages/properties/${s.propertyId}`}
                            className="hover:underline"
                          >
                            {s.name ? `${s.name} — ${s.address}` : s.address}
                          </Link>
                          <span className="text-muted-foreground">
                            {s.score}% match
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}

                {draft.reasoning ? (
                  <details className="text-xs text-muted-foreground">
                    <summary className="cursor-pointer">AI reasoning</summary>
                    <p className="mt-1">{draft.reasoning}</p>
                  </details>
                ) : null}
              </div>

              <SheetFooter className="border-t p-4">
                <div className="flex w-full flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      onClick={dismiss}
                      disabled={submitting}
                    >
                      <X className="mr-1 size-4" /> Dismiss
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={copyToClipboard}
                      disabled={submitting}
                    >
                      <Clipboard className="mr-1 size-4" /> Copy
                    </Button>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => saveEdits(false)}
                      disabled={
                        submitting ||
                        (editedSubject === draft.subject &&
                          editedBody === draft.body)
                      }
                    >
                      Save edits
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={approve}
                      disabled={submitting}
                    >
                      <Check className="mr-1 size-4" /> Approve & log
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      onClick={send}
                      disabled={submitting || !contactEmail}
                      title={
                        contactEmail
                          ? `Sends from Matt's mailbox via Graph to ${contactEmail}`
                          : "No email on file for this contact"
                      }
                    >
                      <Send className="mr-1 size-4" /> Send now
                    </Button>
                  </div>
                </div>
              </SheetFooter>
            </div>
          ) : null}
        </SheetContent>
      </Sheet>
    </>
  )
}
