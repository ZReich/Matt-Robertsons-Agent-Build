import {
  ArrowDownLeft,
  ArrowUpRight,
  ExternalLink,
  Mail,
  MessageSquare,
  Phone,
  Smartphone,
} from "lucide-react"

import type { AttachmentSummary } from "@/lib/communications/attachment-types"
import type { CommunicationChannel, Direction } from "@prisma/client"
import type { ReactNode } from "react"

import { AttachmentSummaryInline } from "@/components/communications/attachment-summary-inline"

const CHANNEL_ICONS: Record<string, ReactNode> = {
  email: <Mail className="size-3.5" />,
  call: <Phone className="size-3.5" />,
  text: <MessageSquare className="size-3.5" />,
  whatsapp: <Smartphone className="size-3.5" />,
}

export interface LeadActivityItem {
  id: string
  channel: CommunicationChannel
  subject: string | null
  body: string | null
  date: Date
  direction: Direction | null
  outlookUrl?: string | null
  attachments?: AttachmentSummary
}

interface LeadActivityTimelineProps {
  communications: LeadActivityItem[]
}

function formatDate(date: Date): string {
  return date.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  })
}

function snippet(text: string | null, max = 320): string {
  if (!text) return ""
  const paragraphs = text
    .split(/\n{2,}/)
    .map((paragraph) => paragraph.replace(/\s+/g, " ").trim())
    .filter(Boolean)

  const chunks: string[] = []
  let length = 0

  for (const paragraph of paragraphs) {
    const nextLength = length + paragraph.length
    if (chunks.length > 0 && nextLength > max) break

    if (paragraph.length > max) {
      chunks.push(`${paragraph.slice(0, max).trim()}...`)
      break
    }

    chunks.push(paragraph)
    length = nextLength

    if (chunks.length >= 2) break
  }

  return chunks.join("\n\n")
}

export function LeadActivityTimeline({
  communications,
}: LeadActivityTimelineProps) {
  if (communications.length === 0) {
    return (
      <p className="text-xs italic text-muted-foreground">No activity yet.</p>
    )
  }

  const sorted = [...communications].sort(
    (a, b) => b.date.getTime() - a.date.getTime()
  )

  return (
    <div className="grid gap-3">
      {sorted.map((communication) => {
        const isInbound = communication.direction === "inbound"
        const bodySnippet = snippet(communication.body, 460)
        return (
          <article
            key={communication.id}
            className="rounded-md border bg-background p-3"
          >
            <div className="mb-2 flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="mb-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                  <span
                    className={
                      isInbound
                        ? "flex items-center gap-1 font-medium text-emerald-600"
                        : "flex items-center gap-1 font-medium text-blue-600"
                    }
                  >
                    {isInbound ? (
                      <ArrowDownLeft className="size-3" />
                    ) : (
                      <ArrowUpRight className="size-3" />
                    )}
                    {isInbound ? "Inbound" : "Outbound"}
                  </span>
                  <span>{CHANNEL_ICONS[communication.channel] ?? null}</span>
                  <span className="capitalize">{communication.channel}</span>
                </div>
                {communication.subject ? (
                  <h3 className="line-clamp-2 text-sm font-medium text-foreground">
                    {communication.subject}
                  </h3>
                ) : null}
              </div>
              <div className="flex shrink-0 items-center gap-2">
                {communication.outlookUrl ? (
                  <a
                    href={communication.outlookUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 rounded-md border px-2 py-1 text-xs text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                  >
                    <ExternalLink className="size-3" />
                    Outlook
                  </a>
                ) : null}
                <time className="text-xs text-muted-foreground">
                  {formatDate(communication.date)}
                </time>
              </div>
            </div>
            <AttachmentSummaryInline summary={communication.attachments} />
            {bodySnippet ? (
              <p className="whitespace-pre-line rounded-md bg-muted/20 px-3 py-2 text-sm leading-relaxed text-foreground/90">
                {bodySnippet}
              </p>
            ) : null}
          </article>
        )
      })}
    </div>
  )
}
