"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { Sparkles } from "lucide-react"

import { Button } from "@/components/ui/button"

export function ProcessDailyListingsButton() {
  const router = useRouter()
  const [running, setRunning] = useState(false)

  async function run() {
    setRunning(true)
    try {
      const res = await fetch("/api/daily-listings/process", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sweep: true, lookbackDays: 14 }),
      })
      const json = (await res.json()) as {
        ok?: boolean
        candidates?: number
        processed?: number
        results?: Array<{
          ok: boolean
          parsed?: number
          newProperties?: number
          draftsCreated?: number
          draftsSent?: number
          errors?: string[]
        }>
        error?: string
      }
      if (!res.ok || !json.ok) {
        toast.error(json.error ?? "Sweep failed")
        return
      }
      const totals = (json.results ?? []).reduce(
        (acc, r) => ({
          parsed: acc.parsed + (r.parsed ?? 0),
          newProperties: acc.newProperties + (r.newProperties ?? 0),
          draftsCreated: acc.draftsCreated + (r.draftsCreated ?? 0),
          draftsSent: acc.draftsSent + (r.draftsSent ?? 0),
          errors: acc.errors + (r.errors?.length ?? 0),
        }),
        {
          parsed: 0,
          newProperties: 0,
          draftsCreated: 0,
          draftsSent: 0,
          errors: 0,
        }
      )
      toast.success(
        `Swept ${json.processed}/${json.candidates} digests · ${totals.parsed} listings · ${totals.newProperties} new props · ${totals.draftsCreated} drafts · ${totals.draftsSent} sent${totals.errors ? " · " + totals.errors + " errors" : ""}`,
        { duration: 8000 }
      )
      router.refresh()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Network error")
    } finally {
      setRunning(false)
    }
  }

  return (
    <Button size="sm" variant="outline" onClick={run} disabled={running}>
      <Sparkles className="mr-1 size-4" />
      {running ? "Sweeping…" : "Process Daily Listings"}
    </Button>
  )
}
