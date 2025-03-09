"use client"

import { useIsDarkMode } from "@/hooks/use-mode"

const defaultModes = ["light", "dark"]

export function ModeProvider({ children }: { children: React.ReactNode }) {
  const isDarkMode = useIsDarkMode()

  const mode = isDarkMode ? "dark" : "light"

  // Update class name in the <html> tag
  const rootElement = document.documentElement
  rootElement.classList.remove(...defaultModes)
  if (mode) rootElement.classList.add(mode)

  return <>{children}</>
}
