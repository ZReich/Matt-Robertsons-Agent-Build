"use client";

import * as React from "react";

import { BaseColor } from "@/configs/base-colors";

import type { Direction, Layout, Mode } from "@/types";

export type Settings = {
  theme: BaseColor["name"];
  mode: Mode;
  radius: number;
  layout: Layout;
  direction: Direction;
};

export const defaultSettings: Settings = {
  theme: "zinc",
  mode: "system",
  radius: 0.5,
  layout: "vertical",
  direction: "ltr",
};

export const SettingsContext = React.createContext<
  | {
      settings: Settings;
      updateSettings: (newSettings: Settings) => void;
      resetSettings: () => void;
    }
  | undefined
>(undefined);
