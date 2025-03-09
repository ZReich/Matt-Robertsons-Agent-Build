"use client"

import * as React from "react"
import { ChevronDown, Eye, RefreshCw } from "lucide-react"

import type { PerformanceOverTimeType } from "../../../types"

import { cn } from "@/lib/utils"

import { Badge } from "@/components/ui/badge"
import { buttonVariants } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Separator } from "@/components/ui/separator"

export function PerformanceOverTimeSummary({
  data,
}: {
  data: PerformanceOverTimeType["summary"]
}) {
  return (
    <div className="flex justify-evenly items-center gap-x-6 py-4">
      <ul className="space-y-2">
        <li className="flex gap-x-2">
          <Badge
            style={{
              backgroundColor: "hsl(var(--chart-1))",
            }}
            className="size-12 aspect-square bg-chart-1 shadow-none"
            aria-hidden
          >
            <Eye className="size-full" />
          </Badge>
          <div className="shrink-0">
            <h3 className="text-xs">Total Visitors</h3>
            <p className="text-2xl">{data.totalVisitors.toLocaleString()}</p>
          </div>
        </li>
        <li className="flex gap-x-2">
          <Badge
            style={{
              backgroundColor: "hsl(var(--chart-2))",
            }}
            className="size-12 aspect-square bg-chart-2 shadow-none"
            aria-hidden
          >
            <RefreshCw className="size-full" />
          </Badge>
          <div className="shrink-0">
            <h3 className="text-xs">Total Conversions</h3>
            <p className="text-2xl">{data.totalConversions.toLocaleString()}</p>
          </div>
        </li>
      </ul>
      <Separator orientation="vertical" className="h-24" />
      <DropdownMenu>
        <DropdownMenuTrigger
          className={cn(
            buttonVariants({ variant: "secondary" }),
            "w-24 justify-between [&[data-state=open]>svg]:rotate-180"
          )}
        >
          <span>2024</span>
          <ChevronDown className="h-4 w-4 shrink-0 ms-2 transition-transform duration-200" />
        </DropdownMenuTrigger>
        <DropdownMenuContent className="min-w-24">
          <DropdownMenuRadioGroup value="2024">
            <DropdownMenuRadioItem value="2024">2024</DropdownMenuRadioItem>
            <DropdownMenuRadioItem value="2023">2023</DropdownMenuRadioItem>
            <DropdownMenuRadioItem value="2022">2022</DropdownMenuRadioItem>
          </DropdownMenuRadioGroup>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  )
}
