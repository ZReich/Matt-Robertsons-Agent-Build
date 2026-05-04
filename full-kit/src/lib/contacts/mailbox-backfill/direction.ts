export interface DirectionInput {
  from: string | null | undefined
  targetUpn: string
}

export function inferDirection(input: DirectionInput): "inbound" | "outbound" {
  if (!input.from) return "inbound"
  return input.from.toLowerCase() === input.targetUpn.toLowerCase()
    ? "outbound"
    : "inbound"
}
