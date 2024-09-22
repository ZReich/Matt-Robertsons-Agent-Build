"use client";

import { MonthlyConversionSummaryType } from "../monthly-conversion-summary";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export function MonthlyConversionSummaryTable({
  data,
}: {
  data: MonthlyConversionSummaryType[];
}) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Month</TableHead>
          <TableHead>Conversions</TableHead>
          <TableHead>Revenue</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {data.map((item) => (
          <TableRow key={item.month}>
            <TableCell className="font-medium">{item.month}</TableCell>
            <TableCell>{item.conversions}</TableCell>
            <TableCell>
              {new Intl.NumberFormat("en-US", {
                style: "currency",
                currency: "USD",
              }).format(item.revenue)}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
