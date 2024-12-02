"use client";

import * as React from "react";

import type { SettingsType } from "@/types";

export const defaultSettings: SettingsType = {
  theme: "zinc",
  mode: "system",
  radius: 0.5,
  layout: "vertical",
  locale: "en",
};

export const SettingsContext = React.createContext<
  | {
      settings: SettingsType;
      updateSettings: (newSettings: SettingsType) => void;
      resetSettings: () => void;
    }
  | undefined
>(undefined);
