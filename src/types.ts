import { IconProps } from "@radix-ui/react-icons/dist/types";
import { LucideIcon } from "lucide-react";

export type Layout = "vertical" | "horizontal";

export type Mode = "light" | "dark" | "system";

export type Orientation = "vertical" | "horizontal";

export type Direction = "ltr" | "rtl";

export type Icon = React.ComponentType<IconProps> | LucideIcon;
