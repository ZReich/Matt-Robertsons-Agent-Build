"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { RefreshCw, Sparkles } from "lucide-react"

import { Button } from "@/components/ui/button"

type CachedSummary = {
  summary: string
  generatedAt: string
  modelUsed: string
} | null

type ApiResponse =
  | {
      ok: true
      summary: {
        summary: string
        generatedAt: string | Date
        modelUsed: string
        fromCache: boolean
      }
    }
  | { ok?: false; error?: string }

export function CandidateThreadSummary({
  candidateId,
  initialSummary,
}: {
  candidateId: string
  initialSummary: CachedSummary
}) {
  const router = useRouter()
  const [summary, setSummary] = useState<CachedSummary>(initialSummary)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function generate(force = false) {
    setLoading(true)
    setError(null)
    try {
      const response = await fetch(
        `/api/contact-promotion-candidates/${candidateId}/thread-summary`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ force }),
        }
      )
      const payload = (await response.json().catch(() => ({}))) as ApiResponse
      if (!response.ok || !("summary" in payload) || !payload.summary) {
        const msg =
          ("error" in payload && payload.error) || `error (${response.status})`
        setError(msg)
        return
      }
      const s = payload.summary
      setSummary({
        summary: s.summary,
        generatedAt:
          typeof s.generatedAt === "string"
            ? s.generatedAt
            : s.generatedAt.toISOString(),
        modelUsed: s.modelUsed,
      })
      router.refresh()
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "request failed")
    } finally {
      setLoading(false)
    }
  }

  if (summary) {
    return (
      <div className="rounded-md border bg-muted/30 p-3 text-sm">
        <div className="mb-1 flex items-center justify-between gap-2">
          <p className="flex items-center gap-1.5 text-xs font-medium uppercase text-muted-foreground">
            <Sparkles className="size-3" /> Thread summary
          </p>
          <Button
            variant="ghost"
            size="sm"
            className="h-6 px-2"
            onClick={() => generate(true)}
            disabled={loading}
          >
            <RefreshCw
              className={`size-3 ${loading ? "animate-spin" : ""}`}
            />
          </Button>
        </div>
        {error ? (
          <p className="mb-1 text-xs text-destructive">{error}</p>
        ) : null}
        <p className="whitespace-pre-line break-words">{summary.summary}</p>
        <p className="mt-2 text-xs text-muted-foreground">
          Generated {new Date(summary.generatedAt).toLocaleString()} via{" "}
          {summary.modelUsed}
        </p>
      </div>
    )
  }

  return (
    <div className="rounded-md border border-dashed bg-muted/20 p-3 text-sm">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-muted-foreground">
          Summarize this candidate&apos;s evidence emails into a paragraph
          you can scan in a few seconds.
        </p>
        <Button
          size="sm"
          variant="outline"
          onClick={() => generate(false)}
          disabled={loading}
          className="h-7"
        >
          <Sparkles className="me-1 size-3" />
          {loading ? "Generating…" : "Summarize thread"}
        </Button>
      </div>
      {error ? <p className="mt-2 text-xs text-destructive">{error}</p> : null}
    </div>
  )
}
