"use client";

import { z } from "zod";
import { CartesianGrid, Line, LineChart, XAxis } from "recharts";

import { chartConfig } from "@/configs/chart-config";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";

const RevenueTrendSchema = z.object({
  month: z.string(),
  revenue: z.number().nonnegative(),
});

type RevenueTrend = z.infer<typeof RevenueTrendSchema>;

export function RevenueTrend() {
  const revenueTrendData: RevenueTrend[] = [
    { month: "January", revenue: 5000 },
    { month: "February", revenue: 5500 },
    { month: "March", revenue: 5000 },
    { month: "April", revenue: 6000 },
    { month: "May", revenue: 6500 },
    { month: "June", revenue: 7000 },
    { month: "July", revenue: 7250 },
    { month: "August", revenue: 7250 },
    { month: "September", revenue: 6500 },
    { month: "October", revenue: 6000 },
    { month: "November", revenue: 7000 },
    { month: "December", revenue: 8000 },
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle>Revenue Trend</CardTitle>
      </CardHeader>
      <CardContent>
        <ChartContainer config={chartConfig}>
          <LineChart
            accessibilityLayer
            data={revenueTrendData}
            margin={{
              left: 12,
              right: 12,
            }}
          >
            <CartesianGrid vertical={false} />
            <XAxis
              dataKey="month"
              tickLine={false}
              axisLine={false}
              tickMargin={8}
              tickFormatter={(value) => value.slice(0, 3)}
            />
            <ChartTooltip
              cursor={false}
              content={<ChartTooltipContent hideLabel />}
            />
            <Line
              dataKey="revenue"
              type="natural"
              strokeWidth={2}
              dot={false}
            />
          </LineChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}
