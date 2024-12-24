import { icons } from "lucide-react";

import { BaseColor } from "@/configs/base-colors";

import type { LucideIcon } from "lucide-react";
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

export type DynamicIconNameType = keyof typeof icons;

export interface NotificationType {
  unreadCount: number;
  notifications: Array<{
    id: string;
    iconName: DynamicIconNameType;
    content: string;
    url: string;
    date: Date;
    isRead: boolean;
  }>;
}

export type FormatStyleType = "percent" | "duration" | "currency" | "regular";

export interface NavigationGroupType {
  title: string;
  items: NavigationType[];
}

export interface NavigationType {
  title: string;
  href: string;
  label?: string;
  iconName: DynamicIconNameType;
}
