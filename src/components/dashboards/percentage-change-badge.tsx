import * as React from "react";
import { TrendingUp, TrendingDown } from "lucide-react";

import { cn, formatPercent, isNonNegative } from "@/lib/utils";

import type { BadgeProps } from "@/components/ui/badge";

import { Badge } from "@/components/ui/badge";

interface PercentageChangeBadgeProps extends BadgeProps {
  value: number;
}

export function PercentageChangeBadge({
  value,
  className,
  ...props
}: PercentageChangeBadgeProps) {
  const isNonNegativeChange = isNonNegative(value);

  return (
    <Badge
      variant="destructive"
      className={cn(
        "justify-center",
        isNonNegativeChange && "bg-success hover:bg-success/90",
        className
      )}
      {...props}
    >
      {isNonNegativeChange && <span>+</span>}
      <span>{formatPercent(value)}</span>
      <span className="ms-1" aria-hidden>
        {isNonNegativeChange ? (
          <TrendingUp className="size-4" />
        ) : (
          <TrendingDown className="size-4" />
        )}
      </span>
    </Badge>
  );
}
