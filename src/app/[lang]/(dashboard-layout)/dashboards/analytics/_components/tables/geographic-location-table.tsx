"use client";

import flags from "react-phone-number-input/flags";
import { Country } from "react-phone-number-input";
import { TrendingDown, TrendingUp } from "lucide-react";

import { cn } from "@/lib/utils";

import { GeographicLocationType } from "../../types";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export function GeographicLocationTable({
  data,
}: {
  data: GeographicLocationType[];
}) {
  return (
    <Table className="rounded-lg overflow-hidden">
      <TableHeader>
        <TableRow>
          <TableHead className="w-10" aria-label="Order">
            #
          </TableHead>
          <TableHead>Country</TableHead>
          <TableHead className="">Visitors</TableHead>
          <TableHead className="w-10" aria-label="Growth rate">
            %
          </TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {data.map((item, index) => {
          const Flag = flags[item.countryCode as Country] as React.ElementType;
          const isPositiveChange = item.percentageChange >= 0;

          return (
            <TableRow key={item.country}>
              <TableCell>{index + 1}</TableCell>
              <TableCell className="inline-flex items-center gap-1.5">
                <Flag
                  title={item.country}
                  className="h-4 rounded-sm"
                  aria-hidden
                />
                <span>{item.country}</span>
              </TableCell>
              <TableCell>${item.visitors.toLocaleString()}</TableCell>
              <TableCell
                className={cn(
                  "flex gap-1 text-destructive",
                  isPositiveChange && "text-success"
                )}
              >
                <span>
                  {new Intl.NumberFormat("en-US", {
                    style: "percent",
                    maximumFractionDigits: 2,
                  }).format(item.percentageChange)}
                </span>
                <span className="ms-auto" aria-hidden>
                  {isPositiveChange ? (
                    <TrendingUp className="size-4 text-green-500" />
                  ) : (
                    <TrendingDown className="size-4 text-destructive" />
                  )}
                </span>
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}
