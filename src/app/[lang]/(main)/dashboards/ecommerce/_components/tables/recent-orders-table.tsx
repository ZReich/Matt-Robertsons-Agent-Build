"use client";

import { Badge } from "@/components/ui/badge";
import { RecentOrderType } from "../recent-orders";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatDuration } from "@/lib/date-formatters";

export function RecentOrdersTable({ data }: { data: RecentOrderType[] }) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Customer Name</TableHead>
          <TableHead>Date</TableHead>
          <TableHead>Total Amount</TableHead>
          <TableHead>Status</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {data.map((order) => (
          <TableRow key={order.id}>
            <TableCell>{order.customer_name}</TableCell>
            <TableCell>{formatDuration(order.date)}</TableCell>
            <TableCell>
              {new Intl.NumberFormat("en-US", {
                style: "currency",
                currency: "USD",
              }).format(order.total_amount.value)}
            </TableCell>
            <TableCell>
              <Badge
                variant={order.status === "Completed" ? "default" : "secondary"}
              >
                {order.status}
              </Badge>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
