"use client";

import { useTheme } from "next-themes";

import { useSettings } from "@/hooks/use-settings";

import { baseColors } from "@/configs/base-colors";

interface CustomThemeProviderProps extends React.ComponentProps<"div"> {
  defaultTheme?: string;
}

export function CustomThemeProvider({ children }: CustomThemeProviderProps) {
  const { settings } = useSettings();
  const { resolvedTheme } = useTheme();

  const theme = baseColors.find((color) => color.name === settings.theme);

  const cssVars =
    theme?.cssVars?.[resolvedTheme === "dark" ? "dark" : "light"] || {};

  const style: Record<string, string> = {
    ...Object.fromEntries(
      Object.entries(cssVars).map(([key, value]) => [`--${key}`, value])
    ),
    "--radius": `${settings.radius ?? 0.5}rem`,
  };

  return <div style={style}>{children}</div>;
}
