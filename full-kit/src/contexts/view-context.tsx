"use client"

import { createContext, useCallback, useEffect, useState } from "react"
import { useCookie } from "react-use"

import type { ReactNode } from "react"

/** View modes for the Life/Work toggle */
export type ViewMode = "everything" | "business" | "personal"

const VALID_MODES: ViewMode[] = ["everything", "business", "personal"]

export interface ViewContextType {
  viewMode: ViewMode
  setViewMode: (mode: ViewMode) => void
}

export const ViewContext = createContext<ViewContextType | undefined>(undefined)

export function ViewProvider({ children }: { children: ReactNode }) {
  const [storedMode, setStoredMode] = useCookie("view-mode")
  const [viewMode, setViewModeState] = useState<ViewMode | null>(null)

  // Sync cookie → state after hydration (same pattern as SettingsProvider)
  useEffect(() => {
    if (storedMode && VALID_MODES.includes(storedMode as ViewMode)) {
      setViewModeState(storedMode as ViewMode)
    } else {
      setViewModeState("everything")
    }
  }, [storedMode])

  const setViewMode = useCallback(
    (mode: ViewMode) => {
      setStoredMode(mode)
      setViewModeState(mode)
    },
    [setStoredMode]
  )

  // Don't render until state is hydrated from cookie
  if (!viewMode) {
    return null
  }

  return (
    <ViewContext.Provider value={{ viewMode, setViewMode }}>
      {children}
    </ViewContext.Provider>
  )
}
