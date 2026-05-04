"use client"

import { useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { Check, Clipboard, Pencil, Send, X } from "lucide-react"

import type { PendingReplyStatus } from "@prisma/client"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { SourceCommunicationInline } from "@/components/communications/source-communication-inline"

export interface PendingReplyCardProps {
  lang: string
  reply: {
    id: string
    status: PendingReplyStatus
    draftSubject: string
    draftBody: string
    reasoning: string | null
    modelUsed: string | null
    createdAt: string
    approvedAt: string | null
    dismissedAt: string | null
    dismissReason: string | null
    property: {
      id: string
      name: string | null
      address: string
      listingUrl: string | null
    } | null
    contact: {
      id: string
      name: string
      company: string | null
      email: string | null
      phone: string | null
    } | null
    triggerCommunicationId: string | null
    suggestedProperties: Array<{
      propertyId: string
      address: string
      name: string | null
      score: number
    }>
  }
}

export function PendingReplyCard({ lang, reply }: PendingReplyCardProps) {
  const router = useRouter()
  const [editing, setEditing] = useState(false)
  const [subject, setSubject] = useState(reply.draftSubject)
  const [body, setBody] = useState(reply.draftBody)
  const [submitting, setSubmitting] = useState(false)

  async function call(
    action: "approve" | "dismiss" | "edit" | "send",
    extra: Record<string, unknown> = {}
  ) {
    setSubmitting(true)
    try {
      const res = await fetch(`/api/pending-replies/${reply.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, ...extra }),
      })
      const json = (await res.json()) as {
        ok?: boolean
        error?: string
        reason?: string
        details?: string
      }
      if (!res.ok || !json.ok) {
        const detail = json.details ? ` — ${json.details.slice(0, 200)}` : ""
        toast.error(`${json.error ?? action + " failed"}${detail}`)
        return false
      }
      return true
    } finally {
      setSubmitting(false)
    }
  }

  async function saveEdits() {
    const ok = await call("edit", { draftSubject: subject, draftBody: body })
    if (ok) {
      toast.success("Draft updated")
      setEditing(false)
      router.refresh()
    }
  }

  async function approve() {
    if (editing) {
      const ok = await call("edit", { draftSubject: subject, draftBody: body })
      if (!ok) return
    }
    const ok = await call("approve")
    if (ok) {
      toast.success("Approved — copy the draft into Outlook to send")
      router.refresh()
    }
  }

  async function send() {
    if (!reply.contact?.email) {
      toast.error("No email on file for this contact — can't send")
      return
    }
    const confirmed = window.confirm(
      `Send this reply now to ${reply.contact.email}?\n\nIt will go out from Matt's mailbox via Microsoft Graph.`
    )
    if (!confirmed) return
    if (editing) {
      const ok = await call("edit", { draftSubject: subject, draftBody: body })
      if (!ok) return
    }
    const ok = await call("send")
    if (ok) {
      toast.success(`Sent to ${reply.contact.email}`)
      router.refresh()
    }
  }

  async function dismiss() {
    const reason = window.prompt("Dismiss reason (optional)") ?? ""
    const ok = await call("dismiss", { dismissReason: reason })
    if (ok) {
      toast.success("Dismissed")
      router.refresh()
    }
  }

  async function copyToClipboard() {
    try {
      await navigator.clipboard.writeText(`Subject: ${subject}\n\n${body}`)
      toast.success("Draft copied to clipboard")
    } catch {
      toast.error(
        "Could not copy — your browser may have blocked clipboard access"
      )
    }
  }

  return (
    <Card>
      <CardHeader className="space-y-1">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <CardTitle className="text-base">
            {reply.contact?.name ?? "Unknown inquirer"}
            {reply.contact?.company ? (
              <span className="ml-2 text-xs font-normal text-muted-foreground">
                {reply.contact.company}
              </span>
            ) : null}
          </CardTitle>
          <Badge
            variant={
              reply.status === "pending"
                ? "default"
                : reply.status === "approved"
                  ? "secondary"
                  : "outline"
            }
            className="capitalize"
          >
            {reply.status}
          </Badge>
        </div>
        <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
          {reply.property ? (
            <Link
              href={`/${lang}/pages/properties/${reply.property.id}`}
              className="hover:underline"
            >
              {reply.property.name
                ? `${reply.property.name} — ${reply.property.address}`
                : reply.property.address}
            </Link>
          ) : null}
          {reply.contact?.email ? <span>{reply.contact.email}</span> : null}
          <span>Drafted {new Date(reply.createdAt).toLocaleString()}</span>
          {reply.modelUsed ? <span>via {reply.modelUsed}</span> : null}
        </div>
      </CardHeader>
      <CardContent className="grid gap-3">
        {editing ? (
          <>
            <div>
              <label className="mb-1 block text-xs font-medium text-muted-foreground">
                Subject
              </label>
              <Input
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-muted-foreground">
                Body
              </label>
              <Textarea
                value={body}
                onChange={(e) => setBody(e.target.value)}
                rows={14}
                className="font-mono text-sm"
              />
            </div>
          </>
        ) : (
          <>
            <div>
              <p className="text-xs font-medium text-muted-foreground">
                Subject
              </p>
              <p className="text-sm font-medium">{subject}</p>
            </div>
            <div>
              <p className="mb-1 text-xs font-medium text-muted-foreground">
                Body
              </p>
              <pre className="whitespace-pre-wrap rounded-md border bg-muted/30 p-3 text-sm font-sans">
                {body}
              </pre>
            </div>
          </>
        )}

        {reply.triggerCommunicationId ? (
          <SourceCommunicationInline
            communicationId={reply.triggerCommunicationId}
          />
        ) : null}

        {reply.reasoning ? (
          <details className="text-xs text-muted-foreground">
            <summary className="cursor-pointer">AI reasoning</summary>
            <p className="mt-1">{reply.reasoning}</p>
          </details>
        ) : null}

        {reply.suggestedProperties.length > 0 ? (
          <div className="rounded-md border bg-muted/30 p-2 text-xs">
            <p className="mb-1 font-medium">
              Cross-references mentioned ({reply.suggestedProperties.length})
            </p>
            <ul className="grid gap-1">
              {reply.suggestedProperties.map((s) => (
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

        {reply.status === "dismissed" && reply.dismissReason ? (
          <p className="text-xs text-muted-foreground">
            Dismiss reason: {reply.dismissReason}
          </p>
        ) : null}

        {reply.status === "pending" ? (
          <div className="flex flex-wrap items-center gap-2 pt-2">
            {editing ? (
              <>
                <Button size="sm" onClick={saveEdits} disabled={submitting}>
                  Save edits
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    setEditing(false)
                    setSubject(reply.draftSubject)
                    setBody(reply.draftBody)
                  }}
                  disabled={submitting}
                >
                  Cancel edits
                </Button>
              </>
            ) : (
              <Button
                size="sm"
                variant="outline"
                onClick={() => setEditing(true)}
                disabled={submitting}
              >
                <Pencil className="mr-1 size-4" /> Edit
              </Button>
            )}
            <Button size="sm" variant="outline" onClick={copyToClipboard}>
              <Clipboard className="mr-1 size-4" /> Copy
            </Button>
            <div className="ml-auto flex items-center gap-2">
              <Button
                size="sm"
                variant="ghost"
                onClick={dismiss}
                disabled={submitting}
              >
                <X className="mr-1 size-4" /> Dismiss
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={approve}
                disabled={submitting}
              >
                <Check className="mr-1 size-4" /> Approve & log
              </Button>
              <Button
                size="sm"
                onClick={send}
                disabled={submitting || !reply.contact?.email}
                title={
                  reply.contact?.email
                    ? `Sends from Matt's mailbox via Graph to ${reply.contact.email}`
                    : "No email on file for this contact"
                }
              >
                <Send className="mr-1 size-4" /> Send now
              </Button>
            </div>
          </div>
        ) : (
          <div className="pt-2">
            <Button size="sm" variant="outline" onClick={copyToClipboard}>
              <Clipboard className="mr-1 size-4" /> Copy draft
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
