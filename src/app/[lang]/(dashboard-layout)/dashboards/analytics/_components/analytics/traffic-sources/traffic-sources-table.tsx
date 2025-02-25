"use client";

import {
  Ellipsis,
  EllipsisVertical,
  Eye,
  MousePointer,
  Square,
  Timer,
} from "lucide-react";

import { cn, formatPercent, formatDuration } from "@/lib/utils";

import type { TopPagesType } from "../../../types";

import { Table, TableBody, TableCell, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";

import type { TrafficSourcesType } from "../../../types";

import { TrendingDown, TrendingUp } from "lucide-react";
import { PercentageChangeBadge } from "@/components/dashboards/percentage-change-badge";
import { Button } from "@/components/ui/button";
import { DynamicIcon } from "@/components/dynamic-icon";

export function TrafficSourcesTable({
  data,
}: {
  data: TrafficSourcesType["sources"];
}) {
  return (
    <Table className="rounded-lg overflow-hidden">
      <TableBody>
        {data.map((item) => (
          <TableRow key={item.name}>
            <TableCell className="w-6" aria-hidden>
              <DynamicIcon
                name={item.icon}
                style={{ color: item.fill }}
                className="h-3 w-3 stroke-[3]"
              />
            </TableCell>
            <TableCell className="font-semibold" aria-label="Name">
              {item.name}
            </TableCell>
            <TableCell className="font-semibold" aria-label="Visitors">
              <span>{item.visitors.toLocaleString()}</span>
            </TableCell>
            <TableCell aria-label="Percentage Change">
              <span>{formatPercent(item.percentageChange)}</span>
            </TableCell>
            <TableCell aria-label="Actions">
              <Ellipsis className="h-4 w-4" />
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
