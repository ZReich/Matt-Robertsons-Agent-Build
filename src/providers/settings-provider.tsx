"use client";

import * as React from "react";
import { useCookie } from "react-use";

import { defaultSettings, SettingsContext } from "@/contexts/settings-context";

import type { DirectionType, SettingsType } from "@/types";

export function SettingsProvider({
  direction,
  children,
}: {
  direction: DirectionType;
  children: React.ReactNode;
}) {
  const [storedSettings, setStoredSettings, deleteStoredSettings] =
    useCookie("settings");
  const [settings, setSettings] = React.useState<SettingsType | null>(null);

  React.useEffect(() => {
    if (storedSettings) {
      setSettings(JSON.parse(storedSettings));
    } else {
      setSettings({ ...defaultSettings, direction });
    }
  }, [storedSettings, direction]);

  const updateSettings = React.useCallback(
    (newSettings: SettingsType) => {
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
