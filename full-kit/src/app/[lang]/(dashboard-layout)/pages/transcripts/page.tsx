import Link from "next/link"
import { Mic } from "lucide-react"

import type { Metadata } from "next"

import { db } from "@/lib/prisma"
import { cn } from "@/lib/utils"

import { Card, CardContent } from "@/components/ui/card"
import { TranscriptsTable } from "./_components/transcripts-table"
import { SyncButton } from "./_components/sync-button"

export const metadata: Metadata = {
  title: "Transcripts",
}

export const dynamic = "force-dynamic"

const STATUSES = ["needs_review", "matched", "archived"] as const
type Status = (typeof STATUSES)[number]

interface Props {
  params: Promise<{ lang: string }>
  searchParams?: Promise<Record<string, string | string[] | undefined>>
}

function paramString(v: string | string[] | undefined): string | undefined {
  return typeof v === "string" && v.trim() ? v : undefined
}

export default async function TranscriptsPage({
  params,
  searchParams,
}: Props) {
  const { lang } = await params
  const sp = (await searchParams) ?? {}
  const statusParam = paramString(sp.status)
  const status: Status =
    statusParam === "needs_review" ||
    statusParam === "matched" ||
    statusParam === "archived"
      ? statusParam
      : "needs_review"

  const baseFilter = {
    channel: "call" as const,
    metadata: { path: ["source"], equals: "plaud" } as const,
  }
  const statusFilter =
    status === "needs_review"
      ? { contactId: null, archivedAt: null }
      : status === "matched"
        ? { contactId: { not: null }, archivedAt: null }
        : { archivedAt: { not: null } }

  const [rows, counts] = await Promise.all([
    // take: 100 — sufficient for the daily-review cadence Matt does. Add
    // cursor pagination here if the backlog ever exceeds 100 unmatched
    // recordings; the API route at /api/transcripts already supports it.
    db.communication.findMany({
      where: { ...baseFilter, ...statusFilter },
      orderBy: [{ date: "desc" }, { id: "desc" }],
      take: 100,
      select: {
        id: true,
        subject: true,
        date: true,
        durationSeconds: true,
        contactId: true,
        archivedAt: true,
        metadata: true,
        contact: { select: { id: true, name: true } },
      },
    }),
    Promise.all([
      db.communication.count({
        where: {
          ...baseFilter,
          contactId: null,
          archivedAt: null,
        },
      }),
      db.communication.count({
        where: {
          ...baseFilter,
          contactId: { not: null },
          archivedAt: null,
        },
      }),
      db.communication.count({
        where: { ...baseFilter, archivedAt: { not: null } },
      }),
    ]),
  ])
  const [needsReviewCount, matchedCount, archivedCount] = counts

  // Hydrate suggestion contacts in one batch.
  const suggestionContactIds = new Set<string>()
  for (const r of rows) {
    const meta = (r.metadata ?? {}) as Record<string, unknown>
    const sug = Array.isArray(meta.suggestions)
      ? (meta.suggestions as Array<{ contactId?: unknown }>)
      : []
    for (const s of sug) {
      if (typeof s.contactId === "string") suggestionContactIds.add(s.contactId)
    }
  }
  const sugContacts = suggestionContactIds.size
    ? await db.contact.findMany({
        where: { id: { in: Array.from(suggestionContactIds) } },
        select: { id: true, name: true },
      })
    : []
  const sugContactMap = new Map(sugContacts.map((c) => [c.id, c]))

  const items = rows.map((r) => {
    const meta = (r.metadata ?? {}) as Record<string, unknown>
    const suggestions = Array.isArray(meta.suggestions)
      ? (meta.suggestions as Array<{
          contactId: string
          score: number
          source: string
          reason: string
        }>)
      : []
    const top = suggestions[0]
    const topContact = top ? sugContactMap.get(top.contactId) : undefined
    return {
      id: r.id,
      filename: r.subject ?? "(untitled)",
      date: r.date.toISOString(),
      durationSeconds: r.durationSeconds,
      contactId: r.contactId,
      contactName: r.contact?.name ?? null,
      archivedAt: r.archivedAt?.toISOString() ?? null,
      topSuggestion: top
        ? {
            contactId: top.contactId,
            contactName: topContact?.name ?? null,
            score: top.score,
            source: top.source,
            reason: top.reason,
          }
        : null,
      hasAiSkip: meta.aiSkipReason === "sensitive_keywords",
    }
  })

  return (
    <section className="container grid gap-6 p-6">
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex size-9 items-center justify-center rounded-lg bg-primary/10">
          <Mic className="size-5 text-primary" />
        </div>
        <div className="flex-1">
          <h1 className="text-xl font-semibold">Transcripts</h1>
          <p className="text-sm text-muted-foreground">
            Plaud call recordings imported into the CRM. Review the
            top-suggested contact for each one and attach with one click —
            or pick another contact, or archive.
          </p>
        </div>
        <SyncButton />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {(
          [
            ["needs_review", "Needs review", needsReviewCount],
            ["matched", "Matched", matchedCount],
            ["archived", "Archived", archivedCount],
          ] as const
        ).map(([s, label, count]) => (
          <Link
            key={s}
            href={`?status=${s}`}
            className={cn(
              "rounded-full border px-3 py-1 text-xs font-medium",
              status === s
                ? "border-primary bg-primary/10 text-primary"
                : "text-muted-foreground hover:border-primary/40"
            )}
          >
            {label} ({count})
          </Link>
        ))}
      </div>

      {items.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-sm text-muted-foreground">
            {status === "needs_review"
              ? "No transcripts need review right now. Click 'Sync Plaud' to pull the latest."
              : status === "matched"
                ? "No matched transcripts yet."
                : "No archived transcripts."}
          </CardContent>
        </Card>
      ) : (
        <TranscriptsTable items={items} lang={lang} status={status} />
      )}
    </section>
  )
}
