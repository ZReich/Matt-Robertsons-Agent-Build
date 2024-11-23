"use client";

import { formatCurrency } from "@/lib/utils";
import { SalesTrendType } from "../types";
import { format } from "date-fns";
import { Separator } from "@/components/ui/separator";
import { useMedia } from "react-use";

export function SalesTrendSummary({
  data,
}: {
  data: SalesTrendType["summary"];
}) {
  const isMiniTablet = useMedia("(min-width: 640px)");

  return (
    <div className="flex flex-col justify-around gap-4 sm:flex-row">
      <div className="flex flex-wrap justify-around gap-4 md:flex-col">
        <div>
          <h4 className="text-sm">Highest Sales</h4>
          <p className="text-2xl font-semibold">
            {formatCurrency(data.highestSales.sales)}
          </p>
          <p className="text-xs text-muted-foreground">
            on {format(data.highestSales.date, "MMM dd")}
          </p>
        </div>
        <div>
          <h4 className="text-sm">Lowest Sales</h4>
          <p className="text-2xl font-semibold">
            {formatCurrency(data.lowestSales.sales)}
          </p>
          <p className="text-xs text-muted-foreground">
            on {format(data.lowestSales.date, "MMM dd")}
          </p>
        </div>
      </div>
      {isMiniTablet ? (
        <Separator orientation="vertical" className="h-40" />
      ) : (
        <Separator className="" />
      )}
      <div className="flex flex-wrap justify-around gap-4 md:flex-col">
        <div>
          <h4 className="text-sm">Total Sales</h4>
          <p className="text-2xl font-semibold">
            {formatCurrency(data.totalSales)}
          </p>
          <p className="text-xs text-muted-foreground">for the period</p>
        </div>
        <div>
          <h4 className="text-sm">Avg. Sales</h4>
          <p className="text-2xl font-semibold">
            {formatCurrency(data.avgSales)}
          </p>
          <p className="text-xs text-muted-foreground">per day</p>
        </div>
      </div>
    </div>
  );
}
