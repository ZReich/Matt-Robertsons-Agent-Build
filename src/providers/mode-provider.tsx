"use client";

import { useSettings } from "@/hooks/use-settings";
import { useMedia } from "react-use";

const defaultModes = ["light", "dark"];

const handleUpdateClass = (name: "light" | "dark") => {
  document.documentElement.classList.remove(...defaultModes);
  if (name) document.documentElement.classList.add(name);
};

export function ModeProvider({ children }: { children: React.ReactNode }) {
  const { settings } = useSettings();
  const isDark = useMedia("(prefers-color-scheme: dark)");

  let resolvedMode = settings.mode;

  if (resolvedMode === "system") {
    const resolvedMode = isDark ? "dark" : "light";
    handleUpdateClass(resolvedMode);
  } else {
    handleUpdateClass(resolvedMode);
  }

  return <>{children}</>;
}
