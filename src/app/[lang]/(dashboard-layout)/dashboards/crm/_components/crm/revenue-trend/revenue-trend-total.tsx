"use client";

import type { RevenueTrendType } from "../../../types";

import { cn, formatCurrency } from "@/lib/utils";
import { TrendingDown, TrendingUp } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { PercentageChangeBadge } from "@/components/dashboards/percentage-change-badge";

export function RevenueTrendTotal({
  data,
}: {
  data: RevenueTrendType["summary"];
}) {
  return (
    <div className="flex flex-col items-start bg-accent text-accent-foreground py-2 px-4 rounded-lg">
      <h4 className="text-xs">Total Revenue</h4>
      <p className="text-2xl font-semibold">
        {formatCurrency(data.totalRevenue)}{" "}
        <PercentageChangeBadge
          value={data.totalPercentageChange}
          variant="ghost"
          className="p-0"
        />
      </p>
    </div>
  );
}
