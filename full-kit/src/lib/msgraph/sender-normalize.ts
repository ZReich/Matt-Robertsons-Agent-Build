export interface GraphEmailFrom {
  emailAddress: {
    address: string
    name?: string
  }
}

export interface NormalizedSender {
  address: string
  displayName: string
  isInternal: boolean
  normalizationFailed: boolean
}

/**
 * Normalizes a Graph message `from` object into a canonical SMTP-form sender.
 *
 * Exchange Online sometimes emits the X.500 legacyExchangeDN
 * (`/o=exchangelabs/ou=.../cn=recipients/cn=...-localpart`) for internal-tenant
 * senders instead of a plain SMTP address. We convert the DN back to SMTP by
 * taking the segment after the final `-` and appending the target UPN's domain.
 *
 * X.500 DNs are only emitted for senders within Matt's own Exchange org, so the
 * target tenant's domain is the correct guess.
 * @param targetUpn - The tenant user's UPN (e.g. "matt@contoso.com"). Used to
 *   extract the authoritative domain for both X.500 DN reconstruction and the
 *   `isInternal` flag (exact domain match — X.500 senders are always marked
 *   internal regardless of `targetUpn` since the DN itself implies the tenant).
 */
export function normalizeSenderAddress(
  from: GraphEmailFrom | null | undefined,
  targetUpn: string
): NormalizedSender {
  if (!from?.emailAddress?.address) {
    return {
      address: "",
      displayName: "",
      isInternal: false,
      normalizationFailed: true,
    }
  }

  const raw = from.emailAddress.address
  const displayName = from.emailAddress.name ?? ""
  const targetDomain = targetUpn.split("@")[1]?.toLowerCase() ?? ""

  if (raw.startsWith("/o=") || raw.startsWith("/O=")) {
    const cnSegments = raw.split("/cn=")
    const lastCn = cnSegments[cnSegments.length - 1] ?? ""
    const hashPrefixRe = /^[0-9a-f]{32}-(.+)$/i
    const match = hashPrefixRe.exec(lastCn)
    if (match && match[1] && targetDomain) {
      const localPart = match[1].toLowerCase()
      return {
        address: `${localPart}@${targetDomain}`,
        displayName,
        isInternal: true,
        normalizationFailed: false,
      }
    }
    return {
      address: raw,
      displayName,
      isInternal: false,
      normalizationFailed: true,
    }
  }

  const lower = raw.toLowerCase()
  const atIdx = lower.indexOf("@")
  if (atIdx <= 0 || atIdx === lower.length - 1) {
    return {
      address: lower,
      displayName,
      isInternal: false,
      normalizationFailed: true,
    }
  }
  const domain = lower.slice(atIdx + 1)
  return {
    address: lower,
    displayName,
    isInternal: domain === targetDomain,
    normalizationFailed: false,
  }
}
