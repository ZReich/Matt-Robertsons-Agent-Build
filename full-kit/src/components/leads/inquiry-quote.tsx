import type { LeadSource } from "@prisma/client"

import { cleanLeadMessageText } from "@/lib/leads/message-text"

const ACCENT: Record<LeadSource, string> = {
  crexi: "border-orange-500",
  loopnet: "border-blue-500",
  buildout: "border-violet-500",
  email_cold: "border-gray-500",
  referral: "border-teal-500",
}

interface InquiryQuoteProps {
  source: LeadSource
  message: string | null
}

export function InquiryQuote({ source, message }: InquiryQuoteProps) {
  const cleanMessage = cleanLeadMessageText(message)
  const paragraphs = cleanMessage?.split(/\n{2,}/).filter(Boolean) ?? []

  if (!cleanMessage) {
    return (
      <div className="rounded-r-md border-l-4 border-border bg-muted/20 px-4 py-3 text-sm italic text-muted-foreground">
        No inquiry message extracted.
      </div>
    )
  }

  return (
    <blockquote
      className={`space-y-3 rounded-r-md border-l-4 ${ACCENT[source]} bg-muted/20 px-4 py-3 text-sm leading-relaxed text-foreground`}
    >
      {paragraphs.map((paragraph, index) => (
        <p key={`${paragraph.slice(0, 24)}-${index}`}>{paragraph}</p>
      ))}
    </blockquote>
  )
}
