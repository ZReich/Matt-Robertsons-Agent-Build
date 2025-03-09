"use client"

import { remToPx } from "@/lib/utils"

import { useSettings } from "@/hooks/use-settings"

export function useRadius(asPx = true) {
  const { settings } = useSettings()

  const radius = asPx ? remToPx(settings.radius) : settings.radius

  return radius
}
