"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Check, Loader2, X } from "lucide-react"

import { Button } from "@/components/ui/button"

interface Props {
  contactId: string
  factId: string
}

/**
 * Inline Confirm / Dismiss buttons for AI-inferred profile facts.
 *
 * Audit fix (May 2026): the v7 extractor prompt instructs the model to
 * use confidence 0.3-0.6 for inferred facts; the apply-layer correctly
 * persists these as `status: "review"`. But until this component
 * landed, both contact-detail surfaces filtered `status: "active"` only
 * — meaning every inferred fact was invisible and the v7 prompt was a
 * no-op. These buttons let the operator confirm the fact (promotes to
 * "active", surfaces alongside auto-saved facts) or dismiss it (sets
 * "dismissed", never re-shown — survives re-extraction because the
 * upsert path checks for an existing review-status row first).
 */
export function ProfileFactReviewActions({ contactId, factId }: Props) {
  const router = useRouter()
  const [pending, setPending] = useState<"confirm" | "dismiss" | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function update(status: "active" | "dismissed") {
    setPending(status === "active" ? "confirm" : "dismiss")
    setError(null)
    try {
      const res = await fetch(
        `/api/contacts/${contactId}/profile-facts/${factId}/status`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status }),
        }
      )
      if (!res.ok) {
        setError(`Update failed (${res.status})`)
        setPending(null)
        return
      }
      // Re-fetch the server component so the card re-renders without the
      // dismissed/confirmed fact (or with the active styling).
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Network error")
      setPending(null)
    }
  }

  return (
    <div className="mt-2 flex items-center gap-2">
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="h-7 px-2 text-xs"
        disabled={pending !== null}
        onClick={() => update("active")}
      >
        {pending === "confirm" ? (
          <Loader2 className="mr-1 size-3 animate-spin" />
        ) : (
          <Check className="mr-1 size-3" />
        )}
        Confirm
      </Button>
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="h-7 px-2 text-xs"
        disabled={pending !== null}
        onClick={() => update("dismissed")}
      >
        {pending === "dismiss" ? (
          <Loader2 className="mr-1 size-3 animate-spin" />
        ) : (
          <X className="mr-1 size-3" />
        )}
        Dismiss
      </Button>
      {error ? <span className="text-xs text-red-600">{error}</span> : null}
    </div>
  )
}
