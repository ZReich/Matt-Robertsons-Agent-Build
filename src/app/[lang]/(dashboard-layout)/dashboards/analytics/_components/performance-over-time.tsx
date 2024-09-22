import Link from "next/link";
import { z } from "zod";

import { cn } from "@/lib/utils";

import { getPerformanceOverTimeData } from "../_actions/get-performance-over-time-data";

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { PerformanceOverTimeChart } from "./charts/performance-over-time-chart";

export const PerformanceOverTimeSchema = z.object({
  month: z.string(),
  visitors: z.number().nonnegative(),
  conversions: z.number().nonnegative(),
});

export type PerformanceOverTimeType = z.infer<typeof PerformanceOverTimeSchema>;

export async function PerformanceOverTime() {
  const performanceOverTimeData: PerformanceOverTimeType[] =
    await getPerformanceOverTimeData();

  return (
    <Card>
      <CardHeader>
        <CardTitle>Performance Over Time</CardTitle>
        <CardDescription>Last month</CardDescription>
      </CardHeader>
      <CardContent>
        <PerformanceOverTimeChart data={performanceOverTimeData} />
      </CardContent>
    </Card>
  );
}
