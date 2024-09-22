import Link from "next/link";
import { z } from "zod";

import { cn } from "@/lib/utils";

import { getRecentOrdersData } from "../_actions/get-recent-orders-data";

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { buttonVariants } from "@/components/ui/button";
import { RecentOrdersTable } from "./tables/recent-orders-table";

export const TotalAmountSchema = z.object({
  value: z.number().nonnegative(),
  percentage_change: z.number(),
});

export const RecentOrderSchema = z.object({
  id: z.number().int(),
  customer_name: z.string(),
  date: z.number().int(),
  total_amount: TotalAmountSchema,
  status: z.enum(["Completed", "Pending", "Shipped"]),
});

export type RecentOrderType = z.infer<typeof RecentOrderSchema>;

export async function RecentOrders() {
  const recentOrdersData: RecentOrderType[] = await getRecentOrdersData();

  return (
    <Card>
      <CardHeader>
        <CardTitle>Recent Orders</CardTitle>
        <CardDescription>Last month</CardDescription>
      </CardHeader>
      <CardContent className="pb-0">
        <RecentOrdersTable data={recentOrdersData} />
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
