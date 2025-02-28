import { formatCurrency, formatPercent } from "@/lib/utils";

import type { RevenueBySourceType } from "../../../../types";

import { Badge } from "@/components/ui/badge";

export function RevenueBySourceItem({
  data,
}: {
  data: RevenueBySourceType["sources"][number];
}) {
  return (
    <li className="flex justify-between items-center gap-x-2">
      <div className="flex items-center gap-x-1">
        <div
          style={{
            backgroundColor: data.fill,
          }}
          className="h-2.5 w-2.5 rounded-md"
        />
        <p className="text-muted-foreground">{data.name}</p>
      </div>
      <div className="inline-flex items-center gap-x-1">
        <p className="font-semibold">{formatCurrency(data.value)}</p>
        <Badge
          style={{
            backgroundColor: data.fill,
          }}
          className="w-12 justify-center dark:text-foreground"
        >
          {formatPercent(data.percentage)}
        </Badge>
      </div>
    </li>
  );
}
