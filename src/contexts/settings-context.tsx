"use client"

import {
  Suspense,
  createContext,
  useCallback,
  useEffect,
  useState,
} from "react"
import { useSearchParams } from "next/navigation"
import { useCookie } from "react-use"

import type { LocaleType, SettingsType } from "@/types"
import type { ReactNode } from "react"

export const defaultSettings: SettingsType = {
  theme: "zinc",
  mode: "system",
  radius: "0.5",
  layout: "vertical",
  locale: "en",
}

export const SettingsContext = createContext<
  | {
      settings: SettingsType
      updateSettings: (newSettings: SettingsType) => void
      resetSettings: () => void
    }
  | undefined
>(undefined)

function SettingsProviderContent({
  locale,
  children,
}: {
  locale: LocaleType
  children: ReactNode
}) {
  const [storedSettings, setStoredSettings, deleteStoredSettings] =
    useCookie("settings")
  const [settings, setSettings] = useState<SettingsType | null>(null)
  const searchParams = useSearchParams()

  useEffect(() => {
    let initialSettings = storedSettings
      ? JSON.parse(storedSettings)
      : { ...defaultSettings, locale }

    const queryLayout = searchParams.get("layout")
    const queryMode = searchParams.get("mode")
    const queryRadius = searchParams.get("radius")

    const validModes = ["light", "dark", "system"]
    const validLayouts = ["vertical", "horizontal"]
    const validRadii = [0, 0.3, 0.5, 0.75, 1]

    if (
      (queryLayout && validLayouts.includes(queryLayout)) ||
      (queryMode && validModes.includes(queryMode)) ||
      (queryRadius && validRadii.includes(parseFloat(queryRadius)))
    ) {
      initialSettings = {
        ...initialSettings,
        ...(queryLayout &&
          validLayouts.includes(queryLayout) && { layout: queryLayout }),
        ...(queryMode && validModes.includes(queryMode) && { mode: queryMode }),
        ...(queryRadius &&
          validRadii.includes(parseFloat(queryRadius)) && {
            radius: parseFloat(queryRadius),
          }),
      }
      setStoredSettings(JSON.stringify(initialSettings))
    }

    setSettings(initialSettings)
  }, [storedSettings, locale, searchParams, setStoredSettings])

  const updateSettings = useCallback(
    (newSettings: SettingsType) => {
      setStoredSettings(JSON.stringify(newSettings))
      setSettings(newSettings)
    },
    [setStoredSettings]
  )

  const resetSettings = useCallback(() => {
    deleteStoredSettings()
    setSettings(defaultSettings)
  }, [deleteStoredSettings])

  if (!settings) {
    return null
  }

  return (
    <SettingsContext.Provider
      value={{ settings, updateSettings, resetSettings }}
    >
      {children}
    </SettingsContext.Provider>
  )
}

export function SettingsProvider({
  locale,
  children,
}: {
  locale: LocaleType
  children: ReactNode
}) {
  return (
    <Suspense fallback={null}>
      <SettingsProviderContent locale={locale}>
        {children}
      </SettingsProviderContent>
    </Suspense>
  )
}
