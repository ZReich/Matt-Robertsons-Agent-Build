"use client";

import { z } from "zod";
import { PieChart, Pie, Cell } from "recharts";

import { chartConfig } from "@/configs/chart-config";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";

const LeadSourceSchema = z.object({
  source: z.string(),
  percentage: z.number(),
});

export type LeadSourceType = z.infer<typeof LeadSourceSchema>;

export function LeadSources() {
  const leadSourcesData: LeadSourceType[] = [
    { source: "Social Media", percentage: 30 },
    { source: "Email Campaigns", percentage: 25 },
    { source: "Referrals", percentage: 20 },
    { source: "Website", percentage: 15 },
    { source: "Other", percentage: 10 },
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle>Lead Sources</CardTitle>
      </CardHeader>
      <CardContent>
        <ChartContainer config={chartConfig} className="h-[250px] w-full">
          <PieChart accessibilityLayer>
            <Pie
              data={leadSourcesData}
              labelLine={false}
              dataKey="percentage"
              nameKey="source"
              label={({ source, percentage }) =>
                `${source} ${percentage.toFixed(1)}%`
              }
            >
              {leadSourcesData.map((_, index) => (
                <Cell
                  key={`cell-${index}`}
                  fill={`hsl(var(--chart-${index + 1}))`}
                />
              ))}
            </Pie>
            <ChartTooltip content={<ChartTooltipContent nameKey="source" />} />
          </PieChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}
