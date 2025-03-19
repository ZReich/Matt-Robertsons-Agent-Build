"use client"

import { createContext, useState } from "react"

import type { SettingsType } from "@/types"
import type { ReactNode } from "react"

export type ThemeContextType = Pick<SettingsType, "theme" | "mode" | "radius">

export const defaultTheme: ThemeContextType = {
  theme: "zinc",
  mode: "system",
  radius: 0.5,
}

export const ThemeContext = createContext<
  | {
      theme: ThemeContextType
      updateTheme: (newTheme: ThemeContextType) => void
      resetTheme: () => void
    }
  | undefined
>(undefined)

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState<ThemeContextType>(defaultTheme)

  const updateTheme = (newTheme: ThemeContextType) => {
    setTheme(newTheme)
  }

  const resetTheme = () => {
    setTheme(defaultTheme)
  }

  return (
    <ThemeContext.Provider value={{ theme, updateTheme, resetTheme }}>
      {children}
    </ThemeContext.Provider>
  )
}
