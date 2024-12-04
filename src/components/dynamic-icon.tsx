import { icons } from "lucide-react";

import type { LucideProps } from "lucide-react";
import type { DynamicIconNameType } from "@/types";

interface DynamicIconProps extends LucideProps {
  name: DynamicIconNameType;
}

export function DynamicIcon({ name, ...props }: DynamicIconProps) {
  const LucideIcon = icons[name];

  if (!LucideIcon) return null;

  return <LucideIcon {...props} />;
}
