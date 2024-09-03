"use client";

import { useTheme } from "next-themes";

import { useSettings } from "@/hooks/use-settings";

import { baseColors } from "@/configs/base-colors";

export function CustomThemeProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const { settings } = useSettings();
  const { resolvedTheme } = useTheme();

  const theme = baseColors.find((color) => color.name === settings.theme);

  const cssVars: Record<string, string> =
    theme?.cssVars?.[resolvedTheme === "dark" ? "dark" : "light"] || {};

  // Add radius to cssVars
  cssVars.radius = `${settings.radius ?? 0.5}rem`;

  // Apply the styles to the <html> tag
  Object.entries(cssVars).forEach(([key, value]) => {
    document.documentElement.style.setProperty(`--${key}`, value);
  });

  return <>{children}</>;
}
