"use client";

import flags from "react-phone-number-input/flags";
import { Country } from "react-phone-number-input";
import { Eye, TrendingDown, TrendingUp } from "lucide-react";

import { cn } from "@/lib/utils";

import type { GeographicLocationType } from "../../types";

import { Table, TableBody, TableCell, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";

function getPercentageChangeColor(isPositiveChange: boolean) {
  if (isPositiveChange)
    return "bg-success text-success-foreground hover:bg-success/80";
  return "bg-destructive text-destructive-foreground hover:bg-destructive/80";
}

export function GeographicLocationTable({
  data,
}: {
  data: GeographicLocationType[];
}) {
  return (
    <Table className="rounded-lg overflow-hidden">
      <TableBody>
        {data.map((item, index) => {
          const Flag = flags[item.countryCode as Country] as React.ElementType;
          const isPositiveChange = item.percentageChange >= 0;

          return (
            <TableRow key={item.country}>
              <TableCell className="text-muted-foreground" aria-label="Order">
                {index + 1}
              </TableCell>
              <TableCell
                className="min-w-40 inline-flex items-center gap-2 font-semibold"
                aria-label="Country"
              >
                <Flag
                  title={item.country}
                  className="h-4 rounded-sm"
                  aria-hidden
                />
                <span>{item.country}</span>
              </TableCell>
              <TableCell aria-label="Visitors">
                <Badge variant="secondary" className="justify-center gap-x-1">
                  <Eye className="h-3.5 w-3.5" aria-hidden />
                  <span>{item.visitors.toLocaleString()}</span>
                </Badge>
              </TableCell>
              <TableCell className="w-0" aria-label="Growth rate">
                <Badge
                  variant="secondary"
                  className={cn(
                    "justify-center",
                    getPercentageChangeColor(isPositiveChange)
                  )}
                >
                  {isPositiveChange && <span>+</span>}
                  <span>
                    {new Intl.NumberFormat("en-US", {
                      style: "percent",
                      maximumFractionDigits: 2,
                    }).format(item.percentageChange)}
                  </span>
                  <span className="ms-1" aria-hidden>
                    {isPositiveChange ? (
                      <TrendingUp className="h-3.5 w-3.5" />
                    ) : (
                      <TrendingDown className="h-3.5 w-3.5" />
                    )}
                  </span>
                </Badge>
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}
