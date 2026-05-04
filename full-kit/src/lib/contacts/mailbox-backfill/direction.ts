export interface DirectionInput {
  from: string | null | undefined
  /**
   * Lower-cased addresses that count as "Matt sending it" — primary UPN +
   * any aliases configured via MSGRAPH_SELF_ADDRESSES. Caller is responsible
   * for lower-casing; we re-lowercase the `from` value defensively.
   */
  knownSelfAddresses: ReadonlyArray<string> | ReadonlySet<string>
}

export function inferDirection(input: DirectionInput): "inbound" | "outbound" {
  if (!input.from) return "inbound"
  const fromLower = input.from.toLowerCase()
  const set =
    input.knownSelfAddresses instanceof Set
      ? input.knownSelfAddresses
      : new Set(input.knownSelfAddresses)
  return set.has(fromLower) ? "outbound" : "inbound"
}
