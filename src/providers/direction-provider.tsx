"use client";

import { DirectionProvider as DirectionProviderPrimitive } from "@radix-ui/react-direction";

import { useSettings } from "@/hooks/use-settings";

export function DirectionProvider({ children }: { children: React.ReactNode }) {
  const { settings } = useSettings();

  return (
    <DirectionProviderPrimitive dir={settings.direction}>
      {children}
    </DirectionProviderPrimitive>
  );
}
