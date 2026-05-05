"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { Loader2, RefreshCw } from "lucide-react"

import { Button } from "@/components/ui/button"

export function SyncButton() {
  const router = useRouter()
  const [pending, setPending] = useState(false)
  const [, startTransition] = useTransition()
  const [message, setMessage] = useState<string | null>(null)

  async function onClick(): Promise<void> {
    setPending(true)
    setMessage(null)
    try {
      const res = await fetch("/api/integrations/plaud/sync", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: "{}",
      })
      const body = (await res.json().catch(() => ({}))) as {
        added?: number
        skipped?: number | string
        errors?: number
        queued?: number
        pending?: number
        error?: string
      }
      if (res.status === 409) {
        setMessage("Sync already in progress.")
        return
      }
      if (!res.ok) {
        setMessage(`Sync failed: ${body.error ?? res.statusText}`)
        return
      }
      const added = body.added ?? 0
      const skipped = typeof body.skipped === "number" ? body.skipped : 0
      const errors = body.errors ?? 0
      const queued = body.queued ?? 0
      const pending = body.pending ?? 0
      const parts = [`added ${added}`, `skipped ${skipped}`]
      if (queued) parts.push(`queued ${queued} for transcription`)
      if (pending) parts.push(`${pending} still transcribing`)
      if (errors) parts.push(`errors ${errors}`)
      setMessage(`Sync complete — ${parts.join(", ")}`)
      startTransition(() => router.refresh())
    } catch (err) {
      setMessage(
        `Sync failed: ${err instanceof Error ? err.message : "unknown"}`
      )
    } finally {
      setPending(false)
    }
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <Button onClick={onClick} disabled={pending} variant="default">
        {pending ? (
          <>
            <Loader2 className="me-2 size-4 animate-spin" />
            Syncing…
          </>
        ) : (
          <>
            <RefreshCw className="me-2 size-4" />
            Sync Plaud
          </>
        )}
      </Button>
      {message ? (
        <span className="text-xs text-muted-foreground">{message}</span>
      ) : null}
    </div>
  )
}
