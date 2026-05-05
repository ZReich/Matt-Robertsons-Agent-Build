import Link from "next/link"
import { notFound } from "next/navigation"
import { ArrowLeft, ExternalLink } from "lucide-react"

import type { Metadata } from "next"

import { parseAiContent } from "@/lib/plaud/client"
import { projectSafeMetadata } from "@/lib/plaud/metadata-view"
import { db } from "@/lib/prisma"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { MarkdownRenderer } from "@/components/ui/markdown-renderer"
import { TranscriptDetail } from "./_components/transcript-detail"

export const metadata: Metadata = {
  title: "Transcript",
}

export const dynamic = "force-dynamic"

interface Props {
  params: Promise<{ lang: string; id: string }>
}

export default async function TranscriptDetailPage({ params }: Props) {
  const { lang, id } = await params
  const row = await db.communication.findUnique({
    where: { id },
    include: {
      contact: { select: { id: true, name: true } },
    },
  })
  const rawMeta = (row?.metadata ?? {}) as Record<string, unknown>
  if (!row || row.channel !== "call" || rawMeta.source !== "plaud") {
    notFound()
  }
  // Project to the same allow-list shape the API exposes — keeps the
  // server-rendered tree free of internal AI error blobs and unfiltered
  // upstream fields, regardless of what tampered metadata might contain.
  const meta = projectSafeMetadata(rawMeta)
  const suggestions = meta.suggestions

  const sugContactIds = suggestions.map((s) => s.contactId)
  const sugContacts = sugContactIds.length
    ? await db.contact.findMany({
        where: { id: { in: sugContactIds } },
        select: { id: true, name: true, company: true, email: true },
      })
    : []
  const sugMap = new Map(sugContacts.map((c) => [c.id, c]))

  const dealSuggestions = meta.dealSuggestions
  const dealIds = dealSuggestions.map((d) => d.dealId)
  const sugDeals = dealIds.length
    ? await db.deal.findMany({
        where: { id: { in: dealIds } },
        select: {
          id: true,
          propertyAddress: true,
          stage: true,
          contact: { select: { id: true, name: true } },
        },
      })
    : []
  const dealMap = new Map(sugDeals.map((d) => [d.id, d]))

  // Look up the currently-attached deal (if any) so we can show its
  // address/contact in the "currently attached" pill.
  const currentDeal = row.dealId
    ? await db.deal.findUnique({
        where: { id: row.dealId },
        select: {
          id: true,
          propertyAddress: true,
          contact: { select: { id: true, name: true } },
        },
      })
    : null

  const cleanedTurns = meta.cleanedTurns
  const extractedSignals = meta.extractedSignals
  const aiSummary = parseAiContent(meta.aiSummaryRaw ?? "")

  return (
    <section className="container grid gap-6 p-6">
      <div className="flex items-center gap-3">
        <Button asChild size="sm" variant="ghost">
          <Link href={`/${lang}/pages/transcripts`}>
            <ArrowLeft className="me-1 size-4" />
            Back
          </Link>
        </Button>
        <div className="flex-1">
          <h1 className="text-xl font-semibold">
            {row.subject || "(untitled recording)"}
          </h1>
          <p className="text-sm text-muted-foreground">
            {new Date(row.date).toLocaleString()} ·{" "}
            {fmtDuration(row.durationSeconds)}
            {row.contact ? ` · attached to ${row.contact.name}` : ""}
          </p>
        </div>
        <Button asChild size="sm" variant="outline">
          <a
            href="https://web.plaud.ai/"
            target="_blank"
            rel="noopener noreferrer"
          >
            <ExternalLink className="me-1 size-3" />
            Open in Plaud
          </a>
        </Button>
      </div>

      <TranscriptDetail
        commId={row.id}
        currentContactId={row.contactId}
        currentDealId={row.dealId}
        currentDealLabel={
          currentDeal
            ? `${currentDeal.propertyAddress ?? "(no address)"}${currentDeal.contact?.name ? ` — ${currentDeal.contact.name}` : ""}`
            : null
        }
        suggestions={suggestions.map((s) => ({
          ...s,
          contactName: sugMap.get(s.contactId)?.name ?? null,
          contactCompany: sugMap.get(s.contactId)?.company ?? null,
          contactEmail: sugMap.get(s.contactId)?.email ?? null,
        }))}
        dealSuggestions={dealSuggestions.map((s) => {
          const d = dealMap.get(s.dealId)
          return {
            ...s,
            propertyAddress: d?.propertyAddress ?? null,
            stage: d?.stage ?? null,
            dealContactName: d?.contact?.name ?? null,
          }
        })}
        lang={lang}
      />

      {extractedSignals && extractedSignals.tailSynopsis ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">
              Matt&apos;s notes (end of call)
            </CardTitle>
          </CardHeader>
          <CardContent className="text-sm whitespace-pre-wrap">
            {extractedSignals.tailSynopsis}
          </CardContent>
        </Card>
      ) : null}

      {aiSummary ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">AI summary</CardTitle>
          </CardHeader>
          <CardContent>
            <MarkdownRenderer content={aiSummary} size="compact" />
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Transcript</CardTitle>
        </CardHeader>
        <CardContent>
          {cleanedTurns.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No transcript available.
            </p>
          ) : (
            <div className="grid gap-2 max-h-[60vh] overflow-y-auto pr-2">
              {cleanedTurns.map((t, i) => (
                <div key={i} className="text-sm">
                  <span className="font-medium text-muted-foreground">
                    {t.speaker}:
                  </span>{" "}
                  {t.content}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </section>
  )
}

function fmtDuration(secs: number | null): string {
  if (!secs || !Number.isFinite(secs)) return "—"
  const m = Math.floor(secs / 60)
  const s = Math.floor(secs % 60)
  return `${m}:${String(s).padStart(2, "0")}`
}
