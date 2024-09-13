"use client";

import { z } from "zod";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid } from "recharts";

import { chartConfig } from "@/configs/chart-config";

import { remToPx } from "@/lib/utils";

import { useSettings } from "@/hooks/use-settings";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";

const SalesPipelineSchema = z.object({
  stage: z.string(),
  value: z.number(),
  fill: z.string(),
});

export type SalesPipelineType = z.infer<typeof SalesPipelineSchema>;

export function SalesPipeline() {
  const { settings } = useSettings();

  const salesPipelineData: SalesPipelineType[] = [
    { stage: "Lead", value: 15, fill: "hsl(var(--chart-1))" },
    { stage: "Proposal", value: 12, fill: "hsl(var(--chart-2))" },
    { stage: "Negotiation", value: 8, fill: "hsl(var(--chart-3))" },
    { stage: "Closed", value: 5, fill: "hsl(var(--chart-4))" },
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle>Sales Pipeline</CardTitle>
      </CardHeader>
      <CardContent>
        <ChartContainer
          config={chartConfig}
          className="min-h-[200px] w-full md:min-h-[355px]"
        >
          <BarChart accessibilityLayer data={salesPipelineData}>
            <CartesianGrid vertical={false} />
            <XAxis
              dataKey="stage"
              tickLine={false}
              tickMargin={10}
              axisLine={false}
            />
            <YAxis
              width={30}
              tickLine={false}
              tickMargin={10}
              axisLine={false}
            />
            <ChartTooltip content={<ChartTooltipContent />} />
            <Bar dataKey="value" radius={remToPx(settings.radius)} />
          </BarChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}
