"use client";

import * as React from "react";

import type { SettingsType } from "@/types";

export type ThemeContextType = Pick<SettingsType, "theme" | "mode" | "radius">;

export const defaultTheme: ThemeContextType = {
  theme: "zinc",
  mode: "system",
  radius: 0.5,
};

export const ThemeContext = React.createContext<
  | {
      theme: ThemeContextType;
      updateTheme: (newTheme: ThemeContextType) => void;
      resetTheme: () => void;
    }
  | undefined
>(undefined);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setTheme] = React.useState<ThemeContextType>(defaultTheme);

  const updateTheme = (newTheme: ThemeContextType) => {
    setTheme(newTheme);
  };

  const resetTheme = () => {
    setTheme(defaultTheme);
  };

  return (
    <ThemeContext.Provider value={{ theme, updateTheme, resetTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}
