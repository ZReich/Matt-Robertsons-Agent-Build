"use client";

import * as React from "react";

import { cn, formatPercent } from "@/lib/utils";

import type { TrafficSourcesType } from "../../../types";

import { TrendingDown, TrendingUp } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { PercentageChangeBadge } from "@/components/dashboards/percentage-change-badge";

export function TrafficSourcesSummary({ data }: { data: TrafficSourcesType }) {
  const isPositiveTotalChange = data.summary.totalPercentageChange >= 0;

  return (
    <div className="w-full flex flex-col justify-center items-center gap-8 text-center md:w-1/2">
      <div>
        <p className="text-muted-foreground">Total Visitors</p>
        <p className="text-foreground text-6xl font-semibold">
          {data.summary.totalVisitors.toLocaleString()}
        </p>
        <p
          className={cn(
            "inline-flex items-center text-6xl font-semibold",
            isPositiveTotalChange ? "text-success" : "text-destructive"
          )}
        >
          {formatPercent(data.summary.totalPercentageChange)}
          <span className="ms-1" aria-hidden>
            {isPositiveTotalChange ? (
              <TrendingUp className="size-20" />
            ) : (
              <TrendingDown className="size-20" />
            )}
          </span>
        </p>
      </div>
      <ul className="flex flex-wrap justify-center items-center gap-6">
        {data.sources.map((source) => (
          <li
            key={source.name}
            className="flex justify-between items-center gap-x-4"
          >
            <div className="flex items-center gap-x-2">
              <div
                style={{ backgroundColor: source.fill }}
                className="shrink-0 size-2 rounded-sm"
              />
              <p className="w-max text-foreground">{source.name}</p>
            </div>
            <PercentageChangeBadge value={source.percentageChange} />
          </li>
        ))}
      </ul>
    </div>
  );
}
