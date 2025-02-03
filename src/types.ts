import { icons } from "lucide-react";

import { i18n } from "@/configs/i18n";
import { baseColors } from "@/configs/base-colors";

import type { LucideIcon } from "lucide-react";

export type LayoutType = "vertical" | "horizontal";

export type ModeType = "light" | "dark" | "system";

export type OrientationType = "vertical" | "horizontal";

export type DirectionType = "ltr" | "rtl";

export type LocaleType = (typeof i18n)["locales"][number];

export type BaseColorType = (typeof baseColors)[number];

export type SettingsType = {
  theme: BaseColorType["name"];
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

export interface NavigationType {
  title: string;
  items: NavigationRootItem[];
}

export type NavigationRootItem =
  | NavigationRootItemWithHrefType
  | NavigationRootItemWithItemsType;

export interface NavigationRootItemBasicType {
  title: string;
  label?: string;
  iconName: DynamicIconNameType;
}

export interface NavigationRootItemWithHrefType
  extends NavigationRootItemBasicType {
  href: string;
  items?: never;
}

export interface NavigationRootItemWithItemsType
  extends NavigationRootItemBasicType {
  items: (
    | NavigationNestedItemWithHrefType
    | NavigationNestedItemWithItemsType
  )[];
  href?: never;
}

export interface NavigationNestedItemBasicType {
  title: string;
  label?: string;
}

export interface NavigationNestedItemWithHrefType
  extends NavigationNestedItemBasicType {
  href: string;
  items?: never;
}

export interface NavigationNestedItemWithItemsType
  extends NavigationNestedItemBasicType {
  items: (
    | NavigationNestedItemWithHrefType
    | NavigationNestedItemWithItemsType
  )[];
  href?: never;
}

export type NavigationNestedItem =
  | NavigationNestedItemWithHrefType
  | NavigationNestedItemWithItemsType;

export interface OAuthLinkType {
  href: string;
  label: string;
  icon: IconType;
}
