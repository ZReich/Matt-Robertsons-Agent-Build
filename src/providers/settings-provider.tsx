"use client";

import * as React from "react";

import { defaultSettings, SettingsContext } from "@/contexts/settings-context";

import type { Settings } from "@/contexts/settings-context";
import { useCookie } from "react-use";

export function SettingsProvider({ children }: { children: React.ReactNode }) {
  const [storedSettings, setStoredSettings, deleteStoredSettings] =
    useCookie("settings");

  const initialSettings: Settings = storedSettings
    ? JSON.parse(storedSettings)
    : defaultSettings;

  const [settings, setSettings] = React.useState<Settings>(initialSettings);

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

  return (
    <SettingsContext.Provider
      value={{ settings, updateSettings, resetSettings }}
    >
      {children}
    </SettingsContext.Provider>
  );
}
