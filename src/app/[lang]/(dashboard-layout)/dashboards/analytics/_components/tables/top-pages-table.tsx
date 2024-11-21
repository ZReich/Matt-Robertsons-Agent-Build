"use client";

import { Eye, MousePointer, Timer } from "lucide-react";

import { formatDuration } from "@/lib/date-formatters";
import { cn } from "@/lib/utils";

import type { TopPagesType } from "../../types";

import { Table, TableBody, TableCell, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";

function getBounceRateColor(rate: number) {
  if (rate < 0.4)
    return "bg-success text-success-foreground hover:bg-success/80";
  if (rate < 0.5)
    return "bg-yellow-600 text-success-foreground dark:bg-yellow-700 dark:hover:bg-yellow-800 hover:bg-yellow-500";
  return "bg-destructive text-destructive-foreground hover:bg-destructive/80";
}

export function TopPagesTable({ data }: { data: TopPagesType[] }) {
  return (
    <Table className="rounded-lg overflow-hidden">
      <TableBody>
        {data.map((item, index) => (
          <TableRow key={item.page}>
            <TableCell className="text-muted-foreground" aria-label="Order">
              {index + 1}
            </TableCell>
            <TableCell className="font-semibold" aria-label="Page">
              {item.page}
            </TableCell>
            <TableCell aria-label="Views">
              <Badge
                variant="secondary"
                className="w-max justify-center gap-x-1"
              >
                <Eye className="h-3.5 w-3.5" aria-hidden />
                <span>{item.views}</span>
              </Badge>
            </TableCell>
            <TableCell aria-label="Average time on page">
              <Badge
                variant="secondary"
                className="w-max justify-center gap-x-1"
              >
                <Timer className="h-3.5 w-3.5" aria-hidden />
                <span>{formatDuration(item.avgTimeOnPage)}</span>
              </Badge>
            </TableCell>
            <TableCell aria-label="Bounce rate">
              <Badge
                variant="secondary"
                className={cn(
                  "w-max justify-center gap-x-1",
                  getBounceRateColor(item.bounceRate)
                )}
              >
                <MousePointer className="h-3.5 w-3.5" aria-hidden />
                <span>
                  {new Intl.NumberFormat("en-US", {
                    style: "percent",
                    maximumFractionDigits: 2,
                  }).format(item.bounceRate)}
                </span>
              </Badge>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
