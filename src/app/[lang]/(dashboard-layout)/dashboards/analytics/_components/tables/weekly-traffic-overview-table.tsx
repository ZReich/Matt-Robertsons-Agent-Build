"use client";

import { WeeklyTrafficOverviewType } from "../weekly-traffic-overview";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export function WeeklyTrafficOverviewTable({
  data,
}: {
  data: WeeklyTrafficOverviewType[];
}) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Week</TableHead>
          <TableHead>Visitors</TableHead>
          <TableHead>Page Views</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {data.map((item) => (
          <TableRow key={item.week}>
            <TableCell className="font-medium">{item.week}</TableCell>
            <TableCell>{item.visitors}</TableCell>
            <TableCell>{item.page_views}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
