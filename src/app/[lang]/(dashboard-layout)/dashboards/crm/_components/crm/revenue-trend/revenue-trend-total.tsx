"use client";

import type { RevenueTrendType } from "../../../types";

import { formatCurrency } from "@/lib/utils";
import { PercentageChangeBadge } from "@/components/dashboards/percentage-change-badge";

export function RevenueTrendTotal({
  data,
}: {
  data: RevenueTrendType["summary"];
}) {
  return (
    <div className="flex flex-col items-start bg-accent text-accent-foreground py-2 px-4 rounded-lg">
      <h3 className="text-xs">Total Revenue</h3>
      <div className="flex items-end gap-x-1">
        <p className="text-2xl font-semibold">
          {formatCurrency(data.totalRevenue)}
        </p>
        <PercentageChangeBadge
          value={data.totalPercentageChange}
          variant="ghost"
          className="p-0"
        />
      </div>
    </div>
  );
}
