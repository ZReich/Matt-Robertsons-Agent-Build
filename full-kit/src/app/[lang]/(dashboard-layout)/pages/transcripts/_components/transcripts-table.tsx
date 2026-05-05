"use client"

import { useState, useTransition } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Archive, Check, ExternalLink, Loader2 } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

interface TopSuggestion {
  contactId: string
  contactName: string | null
  score: number
  source: string
  reason: string
}

interface Item {
  id: string
  filename: string
  date: string
  durationSeconds: number | null
  contactId: string | null
  contactName: string | null
  archivedAt: string | null
  backfillPending: boolean
  extractedCounterparty: string | null
  aiProcessed: boolean
  topSuggestion: TopSuggestion | null
}

interface Props {
  items: Item[]
  lang: string
  status: "needs_review" | "matched" | "archived"
}

function fmtDuration(secs: number | null): string {
  if (!secs || !Number.isFinite(secs)) return "—"
  const m = Math.floor(secs / 60)
  const s = Math.floor(secs % 60)
  return `${m}:${String(s).padStart(2, "0")}`
}

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleString()
}

function ConfidencePill({ score, source }: { score: number; source: string }) {
  const cls =
    score >= 80
      ? "bg-green-500/15 text-green-700 dark:text-green-400"
      : score >= 50
        ? "bg-amber-500/15 text-amber-700 dark:text-amber-400"
        : "bg-muted text-muted-foreground"
  const label = source.replace("_", " ")
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${cls}`}
    >
      {score} · {label}
    </span>
  )
}

function SuggestionState({ item }: { item: Item }) {
  if (item.topSuggestion) {
    return (
      <div className="flex flex-col gap-1">
        <span className="font-medium">
          {item.topSuggestion.contactName ?? item.topSuggestion.contactId}
        </span>
        <ConfidencePill
          score={item.topSuggestion.score}
          source={item.topSuggestion.source}
        />
      </div>
    )
  }
  if (item.backfillPending) {
    return <span className="text-muted-foreground">backfill pending</span>
  }
  if (item.aiProcessed) {
    return (
      <span className="text-muted-foreground">
        {item.extractedCounterparty
          ? `AI saw "${item.extractedCounterparty}" - no confident match`
          : "AI processed - no confident match"}
      </span>
    )
  }
  return <span className="text-muted-foreground">not processed yet</span>
}

export function TranscriptsTable({ items, lang, status }: Props) {
  const router = useRouter()
  const [, startTransition] = useTransition()
  const [busyId, setBusyId] = useState<string | null>(null)

  async function attach(commId: string, contactId: string): Promise<void> {
    setBusyId(commId)
    try {
      const res = await fetch(`/api/communications/${commId}/attach-contact`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ contactId }),
      })
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string }
        alert(`Attach failed: ${body.error ?? res.statusText}`)
        return
      }
      startTransition(() => router.refresh())
    } finally {
      setBusyId(null)
    }
  }

  async function archive(commId: string): Promise<void> {
    setBusyId(commId)
    try {
      const res = await fetch(`/api/communications/${commId}/archive`, {
        method: "POST",
        headers: { "content-type": "application/json" },
      })
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string }
        alert(`Archive failed: ${body.error ?? res.statusText}`)
        return
      }
      startTransition(() => router.refresh())
    } finally {
      setBusyId(null)
    }
  }

  return (
    <div className="rounded-lg border bg-card">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Date</TableHead>
            <TableHead>Title</TableHead>
            <TableHead>Duration</TableHead>
            <TableHead>
              {status === "matched" ? "Contact" : "Suggested"}
            </TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {items.map((item) => (
            <TableRow key={item.id}>
              <TableCell className="text-sm whitespace-nowrap">
                {fmtDate(item.date)}
              </TableCell>
              <TableCell className="text-sm">
                <Link
                  href={`/${lang}/pages/transcripts/${item.id}`}
                  className="font-medium text-primary hover:underline"
                >
                  {item.filename}
                </Link>
              </TableCell>
              <TableCell className="text-sm">
                {fmtDuration(item.durationSeconds)}
              </TableCell>
              <TableCell className="text-sm">
                {status === "matched" ? (
                  (item.contactName ?? "—")
                ) : (
                  <SuggestionState item={item} />
                )}
              </TableCell>
              <TableCell className="text-right">
                <div className="flex justify-end gap-2">
                  {status === "needs_review" &&
                  item.topSuggestion &&
                  item.topSuggestion.source !== "counterparty_candidate" ? (
                    <Button
                      size="sm"
                      variant="default"
                      disabled={busyId === item.id}
                      onClick={() =>
                        attach(item.id, item.topSuggestion!.contactId)
                      }
                    >
                      {busyId === item.id ? (
                        <Loader2 className="size-3 animate-spin" />
                      ) : (
                        <>
                          <Check className="me-1 size-3" />
                          Accept
                        </>
                      )}
                    </Button>
                  ) : status === "needs_review" && item.topSuggestion ? (
                    <Button asChild size="sm" variant="outline">
                      <Link href={`/${lang}/pages/transcripts/${item.id}`}>
                        Review
                      </Link>
                    </Button>
                  ) : null}
                  <Button asChild size="sm" variant="outline">
                    <Link href={`/${lang}/pages/transcripts/${item.id}`}>
                      <ExternalLink className="me-1 size-3" />
                      Open
                    </Link>
                  </Button>
                  {status === "needs_review" ? (
                    <Button
                      size="sm"
                      variant="ghost"
                      disabled={busyId === item.id}
                      onClick={() => archive(item.id)}
                    >
                      <Archive className="size-3" />
                    </Button>
                  ) : null}
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}
