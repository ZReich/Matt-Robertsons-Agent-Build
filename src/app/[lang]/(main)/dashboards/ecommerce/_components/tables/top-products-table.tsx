"use client";

import type { TopProductType } from "../top-products";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export function TopProductsTable({ data }: { data: TopProductType[] }) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Product Name</TableHead>
          <TableHead>Sales</TableHead>
          <TableHead>Revenue</TableHead>
          <TableHead>Inventory Left</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {data.map((product) => (
          <TableRow key={product.id}>
            <TableCell>{product.name}</TableCell>
            <TableCell>{product.sales.value}</TableCell>
            <TableCell>
              {new Intl.NumberFormat("en-US", {
                style: "currency",
                currency: "USD",
              }).format(product.revenue.value)}
            </TableCell>
            <TableCell>{product.inventory_left}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
