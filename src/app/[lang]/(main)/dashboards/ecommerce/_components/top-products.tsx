import Link from "next/link";
import { z } from "zod";

import { cn } from "@/lib/utils";

import { getTopProductsData } from "../_actions/get-top-products-data";

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { buttonVariants } from "@/components/ui/button";
import { TopProductsTable } from "./tables/top-products-table";

export const SalesRevenueSchema = z.object({
  value: z.number().nonnegative(),
  percentage_change: z.number(),
});

export const TopProductSchema = z.object({
  id: z.string(),
  name: z.string(),
  sales: SalesRevenueSchema,
  revenue: SalesRevenueSchema,
  inventory_left: z.number().nonnegative(),
});

export type SalesRevenueType = z.infer<typeof SalesRevenueSchema>;
export type TopProductType = z.infer<typeof TopProductSchema>;

export async function TopProducts() {
  const topProductsData: TopProductType[] = await getTopProductsData();

  return (
    <Card>
      <CardHeader>
        <CardTitle>Top Products</CardTitle>
        <CardDescription>Last month</CardDescription>
      </CardHeader>
      <CardContent className="pb-0">
        <TopProductsTable data={topProductsData} />
      </CardContent>
      <CardFooter>
        <Link
          href="#"
          className={cn(buttonVariants({ variant: "link" }), "mt-4 w-full")}
        >
          View More
        </Link>
      </CardFooter>
    </Card>
  );
}
