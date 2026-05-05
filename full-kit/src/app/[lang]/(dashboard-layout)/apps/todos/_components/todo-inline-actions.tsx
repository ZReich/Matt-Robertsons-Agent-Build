"use client"

import { useState } from "react"
import { toast } from "sonner"
import { Check, Pencil, X } from "lucide-react"

import { Button } from "@/components/ui/button"

/**
 * Inline approve/reject buttons that render on a Todo card when the Todo
 * was auto-promoted from an approvable AgentAction. The button set is
 * keyed off `agentActionType` so the operator never has to leave the
 * Todos page to act on a draft reply, a stage change, or a destructive
 * action.
 *
 * Wiring: each button POSTs to the existing /api/agent/actions/[id]
 * endpoints. On success we mark the parent Todo as done so it falls out
 * of the active list. The `onResolved` callback lets the surrounding
 * list optimistically refresh.
 */

interface TodoInlineActionsProps {
  todoPath: string
  agentActionId: string
  agentActionType: string
  onResolved?: () => void
}

type Variant = "approve" | "edit" | "reject"

interface ButtonSpec {
  label: string
  variant: Variant
  /** Tooltip / aria-label */
  hint: string
}

const BUTTON_SETS: Record<string, ButtonSpec[]> = {
  "auto-reply": [
    { label: "Send draft", variant: "approve", hint: "Send the proposed reply as-is" },
    { label: "Edit draft", variant: "edit", hint: "Open the draft to edit before sending" },
    { label: "Reject draft", variant: "reject", hint: "Discard the proposed reply" },
  ],
  "delete-contact": [
    { label: "Confirm delete", variant: "approve", hint: "Delete this contact" },
    { label: "Cancel", variant: "reject", hint: "Keep this contact" },
  ],
  "delete-property": [
    { label: "Confirm delete", variant: "approve", hint: "Delete this property" },
    { label: "Cancel", variant: "reject", hint: "Keep this property" },
  ],
  "delete-deal": [
    { label: "Confirm delete", variant: "approve", hint: "Delete this deal" },
    { label: "Cancel", variant: "reject", hint: "Keep this deal" },
  ],
  "move-deal-stage": [
    { label: "Apply stage change", variant: "approve", hint: "Move the deal to the proposed stage" },
    { label: "Reject", variant: "reject", hint: "Leave the deal stage as-is" },
  ],
  "update-deal": [
    { label: "Apply update", variant: "approve", hint: "Apply the proposed deal update" },
    { label: "Reject", variant: "reject", hint: "Discard the proposed update" },
  ],
  "create-deal": [
    { label: "Create deal", variant: "approve", hint: "Create the proposed deal" },
    { label: "Reject", variant: "reject", hint: "Don't create this deal" },
  ],
  "update-meeting": [
    { label: "Apply change", variant: "approve", hint: "Apply the meeting update" },
    { label: "Reject", variant: "reject", hint: "Leave the meeting as-is" },
  ],
  "set-client-type": [
    { label: "Confirm", variant: "approve", hint: "Apply the client-type change" },
    { label: "Reject", variant: "reject", hint: "Leave the client type as-is" },
  ],
}

export function TodoInlineActions({
  todoPath,
  agentActionId,
  agentActionType,
  onResolved,
}: TodoInlineActionsProps) {
  const [busy, setBusy] = useState<Variant | null>(null)
  const buttons = BUTTON_SETS[agentActionType]
  if (!buttons) return null

  async function run(variant: Variant) {
    if (busy) return
    setBusy(variant)
    try {
      if (variant === "edit") {
        // The "Edit draft" path is intentionally a placeholder for now —
        // the existing draft-reply UI lives elsewhere and is out of
        // scope for this round. Surface a clear message instead of
        // silently doing nothing.
        toast.info(
          "Open the source email to edit the draft. Inline draft editing is coming in the next pass."
        )
        return
      }
      const endpoint =
        variant === "approve"
          ? `/api/agent/actions/${agentActionId}/approve`
          : `/api/agent/actions/${agentActionId}/reject`
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      })
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as {
          error?: string
        } | null
        toast.error(body?.error ?? `Couldn't ${variant} action.`)
        return
      }
      // Mark the Todo done so it leaves the active list. Failure here
      // is non-fatal — the AgentAction is the source of truth.
      await fetch("/api/vault/todos", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ path: todoPath, status: "done" }),
      }).catch(() => {})
      toast.success(
        variant === "approve" ? "Action approved." : "Action rejected."
      )
      onResolved?.()
    } catch {
      toast.error(`Couldn't ${variant} action. Try again.`)
    } finally {
      setBusy(null)
    }
  }

  return (
    <div
      className="flex flex-wrap gap-2 mt-2"
      onClick={(e) => e.stopPropagation()}
    >
      {buttons.map((b) => (
        <Button
          key={b.label}
          size="sm"
          variant={
            b.variant === "approve"
              ? "default"
              : b.variant === "reject"
                ? "outline"
                : "ghost"
          }
          disabled={busy !== null}
          aria-label={b.hint}
          onClick={() => run(b.variant)}
          className="h-7 text-xs"
        >
          {b.variant === "approve" && <Check className="size-3" />}
          {b.variant === "edit" && <Pencil className="size-3" />}
          {b.variant === "reject" && <X className="size-3" />}
          {b.label}
        </Button>
      ))}
    </div>
  )
}
