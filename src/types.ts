import type { LucideIcon } from "lucide-react";

export type Layout = "vertical" | "horizontal";

export type Mode = "light" | "dark" | "system";

export type Orientation = "vertical" | "horizontal";

export type Direction = "ltr" | "rtl";

interface IconProps extends React.SVGAttributes<SVGElement> {
  children?: never;
  color?: string;
}
export type Icon = React.ComponentType<IconProps> | LucideIcon;
