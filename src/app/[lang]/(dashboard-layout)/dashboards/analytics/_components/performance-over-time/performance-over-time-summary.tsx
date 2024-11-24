"use client";

import * as React from "react";
import { ChevronDown, Eye, RefreshCw } from "lucide-react";

import { cn } from "@/lib/utils";

import type { PerformanceOverTimeType } from "../../types";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { buttonVariants } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";

export function PerformanceOverTimeSummary({
  data,
}: {
  data: PerformanceOverTimeType["summary"];
}) {
  return (
    <div className="flex justify-evenly items-center gap-x-6">
      <ul className="space-y-2">
        <li className="flex gap-x-2">
          <Badge
            style={{
              backgroundColor: "hsl(var(--chart-3))",
            }}
            className="size-12 aspect-square bg-chart-3 shadow-none"
            aria-hidden
          >
            <Eye className="size-full" />
          </Badge>
          <div className="shrink-0">
            <h4 className="text-xs">Total Visitors</h4>
            <p className="text-2xl">{data.totalVisitors.toLocaleString()}</p>
          </div>
        </li>
        <li className="flex gap-x-2">
          <Badge
            style={{
              backgroundColor: "hsl(var(--chart-5))",
            }}
            className="size-12 aspect-square bg-chart-5 shadow-none"
            aria-hidden
          >
            <RefreshCw className="size-full" />
          </Badge>
          <div className="shrink-0">
            <h4 className="text-xs">Total Conversions</h4>
            <p className="text-2xl">{data.totalConversions.toLocaleString()}</p>
          </div>
        </li>
      </ul>
      <Separator orientation="vertical" className="h-20" />
      <DropdownMenu>
        <DropdownMenuTrigger
          className={cn(
            buttonVariants(),
            "w-fit [&[data-state=open]>svg]:rotate-180"
          )}
        >
          <span>2024</span>
          <ChevronDown className="h-4 w-4 shrink-0 ms-2 transition-transform duration-200" />
        </DropdownMenuTrigger>
        <DropdownMenuContent className="min-w-fit">
          <DropdownMenuRadioGroup value="2024">
            <DropdownMenuRadioItem value="2024">2024</DropdownMenuRadioItem>
            <DropdownMenuRadioItem value="2023">2023</DropdownMenuRadioItem>
            <DropdownMenuRadioItem value="2022">2022</DropdownMenuRadioItem>
          </DropdownMenuRadioGroup>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
