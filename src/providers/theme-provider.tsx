"use client";

import { baseColors } from "@/configs/base-colors";

import { useSettings } from "@/hooks/use-settings";
import { useIsDarkMode } from "@/hooks/use-mode";

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const { settings } = useSettings();
  const isDarkMode = useIsDarkMode();

  const rootElement = document.documentElement;
  const currentTheme = baseColors.find(
    (color) => color.name === settings.theme
  );
  const cssVars: Record<string, string> =
    currentTheme?.cssVars?.[isDarkMode ? "dark" : "light"] || {};

  // Add radius to cssVars
  cssVars.radius = `${settings.radius ?? 0.5}rem`;

  // Apply the styles to the <html> tag
  Object.entries(cssVars).forEach(([key, value]) => {
    rootElement.style.setProperty(`--${key}`, value);
  });

  return <>{children}</>;
}
