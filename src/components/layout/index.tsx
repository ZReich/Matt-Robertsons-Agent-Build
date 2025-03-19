"use client"

import type { DictionaryType } from "@/lib/get-dictionary"

import { useSettings } from "@/hooks/use-settings"
import { Customizer } from "./customizer"
import { HorizontalLayout } from "./horizontal-layout"
import { VerticalLayout } from "./vertical-layout"

export function Layout({
  children,
  dictionary,
}: {
  children: React.ReactNode
  dictionary: DictionaryType
}) {
  const { settings } = useSettings()
  const isVertical = settings.layout === "vertical"

  return (
    <>
      <Customizer />
      {/* If the layout is vertical, render a vertical layout; otherwise, render a horizontal layout */}
      {isVertical ? (
        <VerticalLayout dictionary={dictionary}>{children}</VerticalLayout>
      ) : (
        <HorizontalLayout dictionary={dictionary}>{children}</HorizontalLayout>
      )}
    </>
  )
}
