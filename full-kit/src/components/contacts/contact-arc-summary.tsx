"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { RefreshCw, Sparkles } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

type CachedSummary = {
  contactId: string
  summary: string
  generatedAt: string
  modelUsed: string
  fromCache: boolean
} | null

type ApiResponse =
  | {
      ok: true
      summary: {
        contactId: string
        summary: string
        generatedAt: string | Date
        modelUsed: string
        fromCache: boolean
      }
    }
  | { ok?: false; error?: string }

export function ContactArcSummary({
  contactId,
  initialSummary,
}: {
  contactId: string
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
      const response = await fetch(`/api/contacts/${contactId}/summary`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ force }),
      })
      const payload = (await response.json().catch(() => ({}))) as ApiResponse
      if (!response.ok || !("summary" in payload) || !payload.summary) {
        const errMsg =
          ("error" in payload && payload.error) || `error (${response.status})`
        setError(errMsg)
        return
      }
      const s = payload.summary
      setSummary({
        contactId: s.contactId,
        summary: s.summary,
        generatedAt:
          typeof s.generatedAt === "string"
            ? s.generatedAt
            : s.generatedAt.toISOString(),
        modelUsed: s.modelUsed,
        fromCache: s.fromCache,
      })
      // Refresh the server component so any other rollups based on the same
      // AgentAction (e.g., last-summarized timestamp) update too.
      router.refresh()
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "request failed")
    } finally {
      setLoading(false)
    }
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
        <CardTitle className="flex items-center gap-2 text-sm text-muted-foreground">
          <Sparkles className="size-3.5" /> Relationship summary
        </CardTitle>
        {summary ? (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => generate(true)}
            disabled={loading}
            className="h-7 px-2"
          >
            <RefreshCw
              className={`size-3.5 ${loading ? "animate-spin" : ""}`}
            />
          </Button>
        ) : null}
      </CardHeader>
      <CardContent className="text-sm">
        {error ? (
          <p className="text-xs text-destructive">{error}</p>
        ) : null}
        {summary ? (
          <>
            <p className="whitespace-pre-line break-words">{summary.summary}</p>
            <p className="mt-2 text-xs text-muted-foreground">
              Generated {new Date(summary.generatedAt).toLocaleString()} via{" "}
              {summary.modelUsed}
            </p>
          </>
        ) : (
          <div className="grid gap-2">
            <p className="text-muted-foreground">
              No summary yet. Click to generate one from this contact&apos;s
              recent communications.
            </p>
            <div>
              <Button
                size="sm"
                onClick={() => generate(false)}
                disabled={loading}
              >
                <Sparkles className="me-2 size-3.5" />
                {loading ? "Generating…" : "Generate summary"}
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
