export type PipelineAgeBucket = "lt7" | "7_30" | "30_90" | "gt90"

export const AGE_BUCKET_LABELS: Record<PipelineAgeBucket, string> = {
  lt7: "<7d",
  "7_30": "7-30d",
  "30_90": "30-90d",
  gt90: ">90d",
}

export function daysSince(
  value: Date | string | null | undefined,
  now = new Date()
) {
  if (!value) return null
  const date = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(date.getTime())) return null
  return Math.max(0, Math.floor((now.getTime() - date.getTime()) / 86_400_000))
}

export function getAgeBucket(days: number | null): PipelineAgeBucket | null {
  if (days === null) return null
  if (days < 7) return "lt7"
  if (days <= 30) return "7_30"
  if (days <= 90) return "30_90"
  return "gt90"
}

export function getAgeBucketForDate(
  value: Date | string | null | undefined,
  now = new Date()
): PipelineAgeBucket | null {
  return getAgeBucket(daysSince(value, now))
}
