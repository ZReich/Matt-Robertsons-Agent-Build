"use client";

import flags from "react-phone-number-input/flags";
import { Country } from "react-phone-number-input";
import { BadgePercent } from "lucide-react";

import type { SalesByCountryType } from "../../types";

import { Table, TableBody, TableCell, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";

export function SalesByCountryTable({
  data,
}: {
  data: SalesByCountryType["countries"];
}) {
  return (
    <Table className="rounded-lg overflow-hidden">
      <TableBody>
        {data.map((item, index) => {
          const Flag = flags[item.countryCode as Country] as React.ElementType;

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
              <TableCell className="w-0" aria-label="Sales">
                <Badge variant="secondary" className="justify-center gap-x-1">
                  <BadgePercent className="h-3.5 w-3.5" aria-hidden />
                  <span>{item.sales.toLocaleString()}</span>
                </Badge>
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}
