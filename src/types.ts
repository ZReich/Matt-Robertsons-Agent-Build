import type { LucideIcon } from "lucide-react";
import { BaseColor } from "@/configs/base-colors";

import type { LocaleType } from "./configs/i18n";

export type LayoutType = "vertical" | "horizontal";

export type ModeType = "light" | "dark" | "system";

export type OrientationType = "vertical" | "horizontal";

export type DirectionType = "ltr" | "rtl";

export type SettingsType = {
  theme: BaseColor["name"];
  mode: ModeType;
  radius: number;
  layout: LayoutType;
  locale: LocaleType;
};

interface IconProps extends React.SVGAttributes<SVGElement> {
  children?: never;
  color?: string;
}
export type IconType = React.ComponentType<IconProps> | LucideIcon;
