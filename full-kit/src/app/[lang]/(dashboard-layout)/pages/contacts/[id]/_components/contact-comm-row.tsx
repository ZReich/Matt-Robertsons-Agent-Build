import Link from "next/link"
import { format } from "date-fns"
import {
  ArrowDownLeft,
  ArrowUpRight,
  Calendar,
  ExternalLink,
  Mail,
  MessageSquare,
  Phone,
  Smartphone,
} from "lucide-react"

import type { ReactNode } from "react"

import { getOutlookDeeplinkForSource } from "@/lib/communications/outlook-deeplink"

// Shared row used by both the Recent Communications card and the Activity feed.
// Pulled out of page.tsx so the streaming server components can reuse it.

export type CommRow = {
  id: string
  channel: string
  subject: string | null
  date: Date
  direction: "inbound" | "outbound" | null
  createdBy: string | null
  externalMessageId: string | null
  deal: { id: string; propertyAddress: string | null } | null
}

export function channelIcon(channel: string): ReactNode {
  switch (channel) {
    case "email":
      return <Mail className="size-4 text-blue-500" />
    case "call":
    case "voice":
      return <Phone className="size-4 text-green-500" />
    case "text":
    case "sms":
      return <MessageSquare className="size-4 text-violet-500" />
    case "whatsapp":
      return <Smartphone className="size-4 text-teal-500" />
    case "meeting":
      return <Calendar className="size-4 text-amber-500" />
    default:
      return <MessageSquare className="size-4 text-muted-foreground" />
  }
}

export function renderCommRow(c: CommRow, lang: string): ReactNode {
  const deeplink = getOutlookDeeplinkForSource(c.externalMessageId, c.createdBy)
  const subject = c.subject?.trim() || `(${c.channel})`
  return (
    <div key={c.id} className="flex items-center gap-2 text-sm">
      <span className="shrink-0">{channelIcon(c.channel)}</span>
      {c.direction === "inbound" ? (
        <ArrowDownLeft className="size-3 shrink-0 text-muted-foreground" />
      ) : c.direction === "outbound" ? (
        <ArrowUpRight className="size-3 shrink-0 text-muted-foreground" />
      ) : null}
      {deeplink ? (
        <a
          href={deeplink}
          target="_blank"
          rel="noopener noreferrer"
          className="flex-1 truncate text-blue-600 hover:underline"
        >
          {subject}
          <ExternalLink className="ms-1 inline size-3 opacity-70" />
        </a>
      ) : (
        <span className="flex-1 truncate">{subject}</span>
      )}
      {c.deal ? (
        <Link
          href={`/${lang}/pages/deals/${c.deal.id}`}
          className="shrink-0 text-xs text-muted-foreground hover:underline"
        >
          {c.deal.propertyAddress ?? "deal"}
        </Link>
      ) : null}
      <span className="shrink-0 text-xs text-muted-foreground">
        {format(c.date, "MMM d, yyyy")}
      </span>
    </div>
  )
}
