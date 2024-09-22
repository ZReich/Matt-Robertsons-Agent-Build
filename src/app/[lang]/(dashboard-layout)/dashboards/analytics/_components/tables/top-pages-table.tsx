"use client";

import { formatDuration } from "@/lib/date-formatters";

import type { TopPageType } from "../top-pages";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export function TopPagesTable({ data }: { data: TopPageType[] }) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Page</TableHead>
          <TableHead>Views</TableHead>
          <TableHead>Avg. Time On Page</TableHead>
          <TableHead>Bounce Rate</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {data.map((item) => (
          <TableRow key={item.page}>
            <TableCell className="font-medium">{item.page}</TableCell>
            <TableCell>{item.views}</TableCell>
            <TableCell>{formatDuration(item.avg_time_on_page)}</TableCell>
            <TableCell>
              {new Intl.NumberFormat("en-US", {
                style: "percent",
                maximumFractionDigits: 2,
              }).format(item.bounce_rate)}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
