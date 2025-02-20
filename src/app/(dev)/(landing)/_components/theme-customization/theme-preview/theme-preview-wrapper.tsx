"use client";

import { baseColors } from "@/configs/base-colors";

import { useTheme } from "../hooks/use-theme";

export function ThemePreviewWrapper({
  children,
}: {
  children: React.ReactNode;
}) {
  const { theme } = useTheme();

  const color = baseColors.find((color) => color.name === theme.theme);

  const cssVars: Record<string, string> =
    color?.cssVars?.[theme.mode === "dark" ? "dark" : "light"] || {};

  // Add radius to cssVars
  cssVars.radius = `${theme.radius ?? 0.5}rem`;

  // Convert cssVars keys into CSS custom properties (CSS variables)
  const style = Object.fromEntries(
    Object.entries(cssVars).map(([key, value]) => [`--${key}`, value])
  );

  return (
    <div
      style={style}
      className="size-full flex justify-center items-center bg-accent rounded-lg transition-colors duration-500"
    >
      {children}
    </div>
  );
}
