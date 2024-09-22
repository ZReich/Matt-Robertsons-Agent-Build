"use client";

import flags from "react-phone-number-input/flags";
import { Country } from "react-phone-number-input";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { GeographicLocationType } from "../geographic-location";

export function GeographicLocationTable({
  data,
}: {
  data: GeographicLocationType[];
}) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>#</TableHead>
          <TableHead>Country</TableHead>
          <TableHead>Visitors</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {data.map((item, index) => {
          const Flag = flags[item.country_code as Country] as React.ElementType;

          return (
            <TableRow key={item.country}>
              <TableCell>{index + 1}</TableCell>
              <TableCell className="flex items-center gap-2">
                <Flag title={item.country} className="h-4 rounded-sm" />
                {item.country}
              </TableCell>
              <TableCell>${item.visitors.toLocaleString()}</TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}
