export type AttachmentCategory =
  | "pdf"
  | "document"
  | "spreadsheet"
  | "presentation"
  | "image"
  | "archive"
  | "text"
  | "email"
  | "other"

export type AttachmentFetchStatus =
  | "not_attempted"
  | "success"
  | "failed"
  | "skipped"

export interface AttachmentMeta {
  id: string
  name: string
  size: number
  contentType: string
  isInline?: boolean
  attachmentType?: "file" | "item" | "reference" | "unknown"
}

export interface AttachmentFetchMeta {
  status: AttachmentFetchStatus
  attemptedAt?: string
  errorCode?: string
  totalCount?: number
  inlineCount?: number
  nonInlineCount?: number
}

export interface AttachmentSummaryItem {
  name: string
  contentType: string
  category: AttachmentCategory
  size?: number
  displaySize?: string
}

export interface AttachmentSummary {
  items: AttachmentSummaryItem[]
  remaining: number
  truncatedRawCount: number
  inlineFilteredCount: number
  fetchStatus?: AttachmentFetchStatus
}

export interface AttachmentSummaryOptions {
  limit?: number
  maxItemsToInspect?: number
  maxNameLength?: number
  includeInline?: boolean
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null
}

function clampInteger(
  value: unknown,
  fallback: number,
  min: number,
  max: number
) {
  const n =
    typeof value === "number" && Number.isFinite(value)
      ? Math.trunc(value)
      : fallback
  return Math.min(max, Math.max(min, n))
}

function truncate(value: string, maxLength: number) {
  return value.length > maxLength
    ? `${value.slice(0, Math.max(0, maxLength - 1))}�`
    : value
}

export function formatAttachmentSize(size: unknown): string | undefined {
  if (!Number.isFinite(size) || typeof size !== "number" || size < 0)
    return undefined
  const units = ["B", "KB", "MB", "GB"] as const
  let value = size
  let unit = 0
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024
    unit += 1
  }
  const formatted =
    unit === 0 || Number.isInteger(value)
      ? String(Math.round(value))
      : value.toFixed(1)
  return `${formatted} ${units[unit]}`
}

function validSize(value: unknown): number | undefined {
  return typeof value === "number" &&
    Number.isFinite(value) &&
    Number.isInteger(value) &&
    value >= 0 &&
    value <= 2_147_483_647
    ? value
    : undefined
}

function normalizeContentType(value: unknown) {
  return typeof value === "string" &&
    value.length >= 1 &&
    value.length <= 128 &&
    value.includes("/")
    ? value.toLowerCase()
    : "application/octet-stream"
}

function extension(name: string) {
  const idx = name.lastIndexOf(".")
  return idx >= 0 ? name.slice(idx).toLowerCase() : ""
}

export function getAttachmentCategory(
  name: string,
  contentType: string
): AttachmentCategory {
  const ext = extension(name)
  const mime = contentType.toLowerCase()
  if (mime === "application/pdf" || ext === ".pdf") return "pdf"
  if (
    mime.startsWith("image/") ||
    [
      ".png",
      ".jpg",
      ".jpeg",
      ".gif",
      ".webp",
      ".tif",
      ".tiff",
      ".bmp",
      ".svg",
    ].includes(ext)
  )
    return "image"
  if (
    mime.includes("spreadsheet") ||
    mime.includes("excel") ||
    mime.includes("csv") ||
    [".xls", ".xlsx", ".csv", ".tsv"].includes(ext)
  )
    return "spreadsheet"
  if (
    mime.includes("presentation") ||
    mime.includes("powerpoint") ||
    [".ppt", ".pptx"].includes(ext)
  )
    return "presentation"
  if (
    mime.includes("wordprocessingml") ||
    mime.includes("msword") ||
    mime.includes("rtf") ||
    mime.includes("opendocument.text") ||
    [".doc", ".docx", ".rtf", ".odt"].includes(ext)
  )
    return "document"
  if (
    mime.includes("zip") ||
    mime.includes("rar") ||
    mime.includes("7z") ||
    mime.includes("gzip") ||
    mime.includes("tar") ||
    [".zip", ".rar", ".7z", ".gz", ".tgz", ".tar"].includes(ext)
  )
    return "archive"
  if (mime.startsWith("text/") || [".txt", ".md"].includes(ext)) return "text"
  if (mime === "message/rfc822" || [".eml", ".msg"].includes(ext))
    return "email"
  return "other"
}

function readFetchStatus(
  metadata: Record<string, unknown>
): AttachmentFetchStatus | undefined {
  const raw = asRecord(metadata.attachmentFetch)?.status
  return raw === "not_attempted" ||
    raw === "success" ||
    raw === "failed" ||
    raw === "skipped"
    ? raw
    : undefined
}

export function getAttachmentSummary(
  metadata: unknown,
  options: AttachmentSummaryOptions = {}
): AttachmentSummary {
  const source = asRecord(metadata)
  const raw = Array.isArray(source?.attachments) ? source.attachments : []
  const limit = clampInteger(options.limit, 5, 0, 20)
  const maxItemsToInspect = clampInteger(options.maxItemsToInspect, 100, 0, 500)
  const maxNameLength = clampInteger(options.maxNameLength, 160, 16, 240)
  const inspected = raw.slice(0, maxItemsToInspect)
  const items: AttachmentSummaryItem[] = []
  let validNonInlineCount = 0
  let inlineFilteredCount = 0

  for (const entry of inspected) {
    const item = asRecord(entry)
    if (!item) continue
    const name = typeof item.name === "string" ? item.name.trim() : ""
    if (!name) continue
    if (!options.includeInline && item.isInline === true) {
      inlineFilteredCount += 1
      continue
    }
    const contentType = normalizeContentType(item.contentType)
    const size = validSize(item.size)
    validNonInlineCount += 1
    if (items.length < limit) {
      items.push({
        name: truncate(name, maxNameLength),
        contentType,
        category: getAttachmentCategory(name, contentType),
        size,
        displaySize: formatAttachmentSize(size),
      })
    }
  }

  return {
    items,
    remaining: Math.max(0, validNonInlineCount - items.length),
    truncatedRawCount: Math.max(0, raw.length - maxItemsToInspect),
    inlineFilteredCount,
    fetchStatus: source ? readFetchStatus(source) : undefined,
  }
}

export function getExplicitAttachmentSummary(
  items: unknown,
  status?: unknown
): AttachmentSummary {
  return getAttachmentSummary({
    attachments: items,
    attachmentFetch: { status },
  })
}
