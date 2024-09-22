import Link from "next/link";
import { z } from "zod";

import { cn } from "@/lib/utils";

import { getTopPagesData } from "../_actions/get-top-pages-data";

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { buttonVariants } from "@/components/ui/button";
import { TopPagesTable } from "./tables/top-pages-table";

export const TopPageSchema = z.object({
  page: z.string(),
  views: z.number().nonnegative(),
  avg_time_on_page: z.number().nonnegative(),
  bounce_rate: z.number().nonnegative(),
});

export type TopPageType = z.infer<typeof TopPageSchema>;

export async function TopPages() {
  const topPageTypeData: TopPageType[] = await getTopPagesData();

  return (
    <Card>
      <CardHeader>
        <CardTitle>Top Pages</CardTitle>
        <CardDescription>Last month</CardDescription>
      </CardHeader>
      <CardContent>
        <TopPagesTable data={topPageTypeData} />
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
