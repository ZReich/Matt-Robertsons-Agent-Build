"use client"

import { useMedia } from "react-use"

import type { SalesTrendType } from "../../../types"

import { formatCurrency, formatDateShort } from "@/lib/utils"

import { Separator } from "@/components/ui/separator"

export function SalesTrendSummary({
  data,
}: {
  data: SalesTrendType["summary"]
}) {
  const isSmallOrLarger = useMedia("(min-width: 640px)")

  return (
    <ul className="flex flex-col justify-around gap-4 sm:flex-row">
      <div className="flex flex-wrap justify-around gap-4 md:flex-col">
        <li>
          <h3 className="text-sm">Highest Sales</h3>
          <p className="text-2xl font-semibold">
            {formatCurrency(data.highestSales.sales)}
          </p>
          <p className="text-xs text-muted-foreground">
            on {formatDateShort(data.highestSales.date)}
          </p>
        </li>
        <li>
          <h3 className="text-sm">Lowest Sales</h3>
          <p className="text-2xl font-semibold">
            {formatCurrency(data.lowestSales.sales)}
          </p>
          <p className="text-xs text-muted-foreground">
            on {formatDateShort(data.lowestSales.date)}
          </p>
        </li>
      </div>
      {isSmallOrLarger ? (
        <Separator orientation="vertical" className="h-40" />
      ) : (
        <Separator />
      )}
      <div className="flex flex-wrap justify-around gap-4 md:flex-col">
        <li>
          <h3 className="text-sm">Total Sales</h3>
          <p className="text-2xl font-semibold">
            {formatCurrency(data.totalSales)}
          </p>
          <p className="text-xs text-muted-foreground">for the period</p>
        </li>
        <li>
          <h3 className="text-sm">Avg. Sales</h3>
          <p className="text-2xl font-semibold">
            {formatCurrency(data.avgSales)}
          </p>
          <p className="text-xs text-muted-foreground">per day</p>
        </li>
      </div>
    </ul>
  )
}
