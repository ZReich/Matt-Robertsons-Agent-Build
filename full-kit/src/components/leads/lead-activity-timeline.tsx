import {
  ArrowDownLeft,
  ArrowUpRight,
  Mail,
  MessageSquare,
  Phone,
  Smartphone,
} from "lucide-react"

import type { CommunicationChannel, Direction } from "@prisma/client"
import type { ReactNode } from "react"

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
    <div className="divide-y divide-border">
      {sorted.map((communication) => {
        const isInbound = communication.direction === "inbound"
        const bodySnippet = snippet(communication.body)
        return (
          <div key={communication.id} className="py-3">
            <div className="mb-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              <span
                className={
                  isInbound
                    ? "flex items-center gap-1 text-emerald-600"
                    : "flex items-center gap-1 text-blue-600"
                }
              >
                {isInbound ? (
                  <ArrowDownLeft className="size-3" />
                ) : (
                  <ArrowUpRight className="size-3" />
                )}
                {isInbound ? "inbound" : "outbound"}
              </span>
              <span>{CHANNEL_ICONS[communication.channel] ?? null}</span>
              {communication.subject ? (
                <span className="text-foreground">{communication.subject}</span>
              ) : null}
              <span className="ms-auto">{formatDate(communication.date)}</span>
            </div>
            {bodySnippet ? (
              <p className="whitespace-pre-line text-sm leading-relaxed text-foreground/90">
                {bodySnippet}
              </p>
            ) : null}
          </div>
        )
      })}
    </div>
  )
}
