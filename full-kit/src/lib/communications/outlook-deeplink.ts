export function getOutlookDeeplink(externalMessageId: string) {
  return `https://outlook.office.com/mail/deeplink/read/${encodeURIComponent(
    externalMessageId
  )}`
}

export function getOutlookDeeplinkForSource(
  externalMessageId: string | null | undefined,
  sourceSystem: string | null | undefined
) {
  if (!externalMessageId || !isOutlookReadableSource(sourceSystem)) return null
  return getOutlookDeeplink(externalMessageId)
}

export function isOutlookReadableSource(
  sourceSystem: string | null | undefined
) {
  if (!sourceSystem) return false
  const normalized = sourceSystem.toLowerCase()
  return (
    normalized.includes("msgraph") ||
    normalized.includes("outlook") ||
    normalized.includes("microsoft-graph")
  )
}
