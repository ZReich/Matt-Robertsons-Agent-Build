"use client"

import { useState } from "react"
import {
  ArrowDownLeft,
  ArrowUpRight,
  Calendar,
  Check,
  Clock,
  Copy,
  FileText,
  Mail,
  MessageSquare,
  Phone,
  Printer,
  Tag,
} from "lucide-react"

import type { ComponentProps } from "react"

import { cn } from "@/lib/utils"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { MarkdownRenderer } from "@/components/ui/markdown-renderer"
import { Separator } from "@/components/ui/separator"

/** Channel icons for communication types */
const CHANNEL_ICONS: Record<string, typeof Phone> = {
  call: Phone,
  email: Mail,
  text: MessageSquare,
  whatsapp: MessageSquare,
  meeting: Calendar,
}

/** Human-readable labels */
const CHANNEL_LABELS: Record<string, string> = {
  call: "Phone Call",
  email: "Email",
  text: "Text Message",
  whatsapp: "WhatsApp",
  meeting: "Meeting Notes",
}

interface DocumentMeta {
  /** Document title or subject */
  title?: string
  /** Channel type: call, email, text, whatsapp, meeting */
  channel?: string
  /** Contact or person name */
  contact?: string
  /** Date of the document */
  date?: string
  /** Direction: inbound or outbound */
  direction?: "inbound" | "outbound"
  /** Associated deal or property */
  deal?: string
  /** Duration in seconds (for calls) */
  durationSeconds?: number
  /** Tags */
  tags?: string[]
  /** Any extra metadata to display as key-value pairs */
  extra?: Record<string, string>
}

interface DocumentViewerProps extends ComponentProps<"div"> {
  /** The markdown content to render */
  content: string
  /** Metadata for the document header */
  meta?: DocumentMeta
  /** Show the copy-to-clipboard button */
  showCopy?: boolean
  /** Show the print button */
  showPrint?: boolean
  /** Render without the card wrapper (for embedding in existing cards) */
  bare?: boolean
}

/** Format duration from seconds to human-readable */
function formatDuration(seconds: number): string {
  if (seconds < 60) return `${seconds}s`
  const mins = Math.floor(seconds / 60)
  const secs = seconds % 60
  if (mins < 60) return secs > 0 ? `${mins}m ${secs}s` : `${mins}m`
  const hrs = Math.floor(mins / 60)
  const remainMins = mins % 60
  return remainMins > 0 ? `${hrs}h ${remainMins}m` : `${hrs}h`
}

/** Format a date string to a nice display format */
function formatDate(dateStr: string): string {
  try {
    const date = new Date(dateStr)
    return date.toLocaleDateString("en-US", {
      weekday: "short",
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    })
  } catch {
    return dateStr
  }
}

/**
 * A polished document viewer for vault notes, transcripts, emails, and other content.
 * Wraps MarkdownRenderer with a metadata header, action buttons, and print styles.
 */
export function DocumentViewer({
  content,
  meta,
  showCopy = true,
  showPrint = true,
  bare = false,
  className,
  ...props
}: DocumentViewerProps) {
  const [copied, setCopied] = useState(false)

  const handleCopy = async () => {
    await navigator.clipboard.writeText(content)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const handlePrint = () => {
    window.print()
  }

  const ChannelIcon = meta?.channel
    ? CHANNEL_ICONS[meta.channel] || FileText
    : FileText

  const channelLabel = meta?.channel
    ? CHANNEL_LABELS[meta.channel] || meta.channel
    : undefined

  const inner = (
    <>
      {/* Document Header */}
      {meta && (
        <>
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1 min-w-0">
              {/* Title row with channel icon */}
              <div className="flex items-center gap-2 mb-1">
                {meta.channel && (
                  <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-primary/10 text-primary shrink-0">
                    <ChannelIcon className="h-4 w-4" />
                  </div>
                )}
                <div className="min-w-0">
                  {meta.title && (
                    <h2 className="font-semibold text-lg leading-tight truncate">
                      {meta.title}
                    </h2>
                  )}
                  {channelLabel && (
                    <p className="text-xs text-muted-foreground">
                      {channelLabel}
                      {meta.direction && (
                        <span className="inline-flex items-center gap-1 ml-2">
                          {meta.direction === "inbound" ? (
                            <ArrowDownLeft className="h-3 w-3 text-success" />
                          ) : (
                            <ArrowUpRight className="h-3 w-3 text-blue-500" />
                          )}
                          {meta.direction === "inbound" ? "Received" : "Sent"}
                        </span>
                      )}
                    </p>
                  )}
                </div>
              </div>

              {/* Metadata chips */}
              <div className="flex flex-wrap items-center gap-2 mt-3 text-sm text-muted-foreground">
                {meta.contact && (
                  <Badge variant="secondary" className="font-normal">
                    {meta.contact}
                  </Badge>
                )}
                {meta.deal && (
                  <Badge variant="outline" className="font-normal">
                    {meta.deal}
                  </Badge>
                )}
                {meta.date && (
                  <span className="inline-flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    {formatDate(meta.date)}
                  </span>
                )}
                {meta.durationSeconds && (
                  <span className="inline-flex items-center gap-1">
                    <Phone className="h-3 w-3" />
                    {formatDuration(meta.durationSeconds)}
                  </span>
                )}
              </div>

              {/* Tags */}
              {meta.tags && meta.tags.length > 0 && (
                <div className="flex flex-wrap items-center gap-1.5 mt-2">
                  <Tag className="h-3 w-3 text-muted-foreground" />
                  {meta.tags.map((tag) => (
                    <Badge
                      key={tag}
                      variant="secondary"
                      className="text-[11px] font-normal px-1.5 py-0"
                    >
                      {tag}
                    </Badge>
                  ))}
                </div>
              )}

              {/* Extra metadata */}
              {meta.extra && Object.keys(meta.extra).length > 0 && (
                <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2 text-xs text-muted-foreground">
                  {Object.entries(meta.extra).map(([key, value]) => (
                    <span key={key}>
                      <span className="font-medium text-foreground">
                        {key}:
                      </span>{" "}
                      {value}
                    </span>
                  ))}
                </div>
              )}
            </div>

            {/* Action buttons */}
            <div className="flex items-center gap-1 shrink-0 print:hidden">
              {showCopy && (
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={handleCopy}
                  className="h-8 w-8"
                  title="Copy raw markdown"
                >
                  {copied ? (
                    <Check className="h-4 w-4 text-success" />
                  ) : (
                    <Copy className="h-4 w-4" />
                  )}
                </Button>
              )}
              {showPrint && (
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={handlePrint}
                  className="h-8 w-8"
                  title="Print document"
                >
                  <Printer className="h-4 w-4" />
                </Button>
              )}
            </div>
          </div>

          <Separator className="my-4 print:my-6" />
        </>
      )}

      {/* Rendered markdown content */}
      <MarkdownRenderer content={content} />
    </>
  )

  if (bare) {
    return (
      <div className={cn("print:p-8", className)} {...props}>
        {inner}
      </div>
    )
  }

  return (
    <Card
      className={cn("print:shadow-none print:border-none", className)}
      {...props}
    >
      <CardContent className="p-6">{inner}</CardContent>
    </Card>
  )
}
