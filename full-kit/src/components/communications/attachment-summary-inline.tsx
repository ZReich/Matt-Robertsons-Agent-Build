import { Paperclip } from "lucide-react"

import type {
  AttachmentSummary,
  AttachmentSummaryItem,
} from "@/lib/communications/attachment-types"

interface AttachmentSummaryInlineProps {
  summary?: AttachmentSummary | null
  items?: AttachmentSummaryItem[]
  remaining?: number
  className?: string
}

function displayType(item: AttachmentSummaryItem) {
  return item.displaySize
    ? `${item.category} � ${item.displaySize}`
    : item.category
}

export function AttachmentSummaryInline({
  summary,
  items,
  remaining,
  className,
}: AttachmentSummaryInlineProps) {
  const visibleItems = summary?.items ?? items ?? []
  const more = summary?.remaining ?? remaining ?? 0
  if (visibleItems.length === 0) return null

  return (
    <div
      className={
        className ??
        "mt-2 flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground"
      }
    >
      <Paperclip className="size-3" aria-hidden="true" />
      {visibleItems.map((item, index) => (
        <span
          key={`${item.name}-${index}`}
          className="inline-flex max-w-[16rem] items-center gap-1 rounded-full border bg-muted/20 px-2 py-0.5"
          title={`${item.name} (${displayType(item)})`}
        >
          <span className="truncate">{item.name}</span>
        </span>
      ))}
      {more > 0 ? (
        <span className="rounded-full border px-2 py-0.5">+{more} more</span>
      ) : null}
    </div>
  )
}
