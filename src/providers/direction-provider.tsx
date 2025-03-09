"use client"

import { DirectionProvider as DirectionProviderPrimitive } from "@radix-ui/react-direction"

import type { DirectionType } from "@/types"

export function DirectionProvider({
  direction,
  children,
}: {
  direction: DirectionType
  children: React.ReactNode
}) {
  return (
    <DirectionProviderPrimitive dir={direction}>
      {children}
    </DirectionProviderPrimitive>
  )
}
