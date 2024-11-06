"use client";

import * as React from "react";
import { useCookie } from "react-use";

import { defaultSettings, SettingsContext } from "@/contexts/settings-context";

import type { Direction } from "@/types";
import type { Settings } from "@/contexts/settings-context";

export function SettingsProvider({
  direction,
  children,
}: {
  direction: Direction;
  children: React.ReactNode;
}) {
  const [storedSettings, setStoredSettings, deleteStoredSettings] =
    useCookie("settings");
  const [settings, setSettings] = React.useState<Settings | null>(null);

  React.useEffect(() => {
    if (storedSettings) {
      setSettings(JSON.parse(storedSettings));
    } else {
      setSettings({ ...defaultSettings, direction });
    }
  }, [storedSettings, direction]);

  const updateSettings = React.useCallback(
    (newSettings: Settings) => {
      setStoredSettings(JSON.stringify(newSettings));
      setSettings(newSettings);
    },
    [setStoredSettings]
  );

  const resetSettings = React.useCallback(() => {
    deleteStoredSettings();
    setSettings(defaultSettings);
  }, [deleteStoredSettings]);

  // Render children only when settings are ready
  if (!settings) {
    return null;
  }

  return (
    <SettingsContext.Provider
      value={{ settings, updateSettings, resetSettings }}
    >
      {children}
    </SettingsContext.Provider>
  );
}
