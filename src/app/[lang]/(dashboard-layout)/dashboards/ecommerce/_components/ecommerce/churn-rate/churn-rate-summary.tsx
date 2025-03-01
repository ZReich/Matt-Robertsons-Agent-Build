import { formatPercent } from "@/lib/utils";
import type { ChurnRateType } from "../../../types";

export function ChurnRateSummary({ data }: { data: ChurnRateType["summary"] }) {
  return (
    <div className="grid grid-cols-3 gap-2">
      <div>
        <p className="inline-flex items-baseline gap-x-1 text-xs">
          <div className="h-2.5 w-2.5 bg-chart-2 rounded-sm" />
          <span>Total Customers</span>
        </p>
        <p className="text-2xl font-semibold">
          {data.totalCustomers.toLocaleString()}
        </p>
      </div>
      <div>
        <p className="inline-flex items-baseline gap-x-1 text-xs">
          <div className="h-2.5 w-2.5 bg-chart-1 rounded-sm" />
          <span>Total Lost Customers</span>
        </p>
        <p className="text-2xl font-semibold">
          {data.totalLostCustomers.toLocaleString()}
        </p>
      </div>
      <div>
        <p className="inline-flex items-baseline gap-x-1 text-xs">
          <div className="h-2.5 w-2.5 bg-white border border-border rounded-sm" />
          <span>Average Churn Rate</span>
        </p>
        <p className="text-2xl font-semibold">
          {formatPercent(data.averageChurnRate)}
        </p>
      </div>
    </div>
  );
}
