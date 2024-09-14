import Link from "next/link";
import { z } from "zod";

import { cn } from "@/lib/utils";

import { getWeeklyTrafficOverviewData } from "../_actions/get-weekly-traffic-overview-data";

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { buttonVariants } from "@/components/ui/button";
import { WeeklyTrafficOverviewTable } from "./tables/weekly-traffic-overview-table";

export const WeeklyTrafficOverviewSchema = z.object({
  week: z.string(),
  visitors: z.number().nonnegative(),
  page_views: z.number().nonnegative(),
});

export type WeeklyTrafficOverviewType = z.infer<
  typeof WeeklyTrafficOverviewSchema
>;

export async function WeeklyTrafficOverview() {
  const weeklyTrafficOverviewData: WeeklyTrafficOverviewType[] =
    await getWeeklyTrafficOverviewData();

  return (
    <Card>
      <CardHeader>
        <CardTitle>Weekly Traffic Overview</CardTitle>
      </CardHeader>
      <CardContent>
        <WeeklyTrafficOverviewTable data={weeklyTrafficOverviewData} />
      </CardContent>
    </Card>
  );
}
