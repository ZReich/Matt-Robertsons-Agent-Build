import Link from "next/link"
import { notFound } from "next/navigation"
import { ArrowLeft, ExternalLink } from "lucide-react"

import type { Metadata } from "next"

import { db } from "@/lib/prisma"
import { parseAiContent } from "@/lib/plaud/client"

import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
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
  const meta = (row?.metadata ?? {}) as Record<string, unknown>
  if (!row || row.channel !== "call" || meta.source !== "plaud") {
    notFound()
  }

  const suggestions = Array.isArray(meta.suggestions)
    ? (meta.suggestions as Array<{
        contactId: string
        score: number
        source: string
        reason: string
      }>)
    : []

  const sugContactIds = suggestions.map((s) => s.contactId)
  const sugContacts = sugContactIds.length
    ? await db.contact.findMany({
        where: { id: { in: sugContactIds } },
        select: { id: true, name: true, company: true, email: true },
      })
    : []
  const sugMap = new Map(sugContacts.map((c) => [c.id, c]))

  const cleanedTurns = Array.isArray(meta.cleanedTurns)
    ? (meta.cleanedTurns as Array<{
        speaker: string
        content: string
        startMs: number
        endMs: number
      }>)
    : []
  const extractedSignals = (meta.extractedSignals ?? null) as {
    counterpartyName: string | null
    topic: string | null
    mentionedCompanies: string[]
    mentionedProperties: string[]
    tailSynopsis: string | null
  } | null
  const aiSummary = parseAiContent(
    typeof meta.aiSummaryRaw === "string" ? meta.aiSummaryRaw : ""
  )

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
            {new Date(row.date).toLocaleString()} · {fmtDuration(row.durationSeconds)}
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

      {meta.aiSkipReason === "sensitive_keywords" ? (
        <Card>
          <CardContent className="py-4 text-sm">
            <strong>AI processing skipped — possible sensitive content.</strong>{" "}
            Match suggestions and AI summary are disabled. Raw transcript is
            still available below.
          </CardContent>
        </Card>
      ) : null}

      <TranscriptDetail
        commId={row.id}
        currentContactId={row.contactId}
        suggestions={suggestions.map((s) => ({
          ...s,
          contactName: sugMap.get(s.contactId)?.name ?? null,
          contactCompany: sugMap.get(s.contactId)?.company ?? null,
          contactEmail: sugMap.get(s.contactId)?.email ?? null,
        }))}
        lang={lang}
        sensitive={meta.aiSkipReason === "sensitive_keywords"}
      />

      {extractedSignals && extractedSignals.tailSynopsis ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Matt's notes (end of call)</CardTitle>
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
          <CardContent className="text-sm whitespace-pre-wrap">
            {aiSummary}
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
            <div className="grid gap-2">
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
