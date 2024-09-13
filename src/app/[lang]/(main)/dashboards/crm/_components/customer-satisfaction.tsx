"use client";

import { z } from "zod";
import {
  Label,
  PolarAngleAxis,
  PolarRadiusAxis,
  RadialBar,
  RadialBarChart,
} from "recharts";

import { chartConfig } from "@/configs/chart-config";

import { remToPx } from "@/lib/utils";

import { useSettings } from "@/hooks/use-settings";

import { ratingToPercentage } from "@/types";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ChartContainer } from "@/components/ui/chart";

const maxRating = 5;

const CustomerSatisfactionSchema = z.object({
  period: z.string(),
  value: z.number(),
});

type CustomerSatisfaction = z.infer<typeof CustomerSatisfactionSchema>;

export function CustomerSatisfaction() {
  const { settings } = useSettings();

  const customerSatisfactionData: CustomerSatisfaction[] = [
    {
      period: "current_period",
      value: 4.2,
    },
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle>Customer Satisfaction</CardTitle>
        <CardDescription>Current Period</CardDescription>
      </CardHeader>
      <CardContent>
        <ChartContainer
          config={chartConfig}
          className="mx-auto aspect-square max-h-[200px] -mt-1"
        >
          <RadialBarChart
            accessibilityLayer
            data={customerSatisfactionData}
            startAngle={0}
            endAngle={360}
            innerRadius={80}
            outerRadius={150}
          >
            <PolarAngleAxis
              type="number"
              domain={[0, maxRating]}
              angleAxisId={0}
              tick={false}
            />
            <RadialBar
              background
              dataKey="value"
              cornerRadius={remToPx(settings.radius)}
              fill="hsl(var(--chart-2))"
            />
            <PolarRadiusAxis tick={false} tickLine={false} axisLine={false}>
              <Label
                content={({ viewBox }) => {
                  if (viewBox && "cx" in viewBox && "cy" in viewBox) {
                    return (
                      <text
                        x={viewBox.cx}
                        y={viewBox.cy}
                        textAnchor="middle"
                        dominantBaseline="middle"
                      >
                        <tspan
                          x={viewBox.cx}
                          y={viewBox.cy}
                          className="fill-foreground text-4xl font-bold"
                        >
                          {customerSatisfactionData[0].value} / 5
                        </tspan>
                        <tspan
                          x={viewBox.cx}
                          y={(viewBox.cy || 0) + 24}
                          className="fill-muted-foreground"
                        >
                          {ratingToPercentage(
                            customerSatisfactionData[0].value,
                            maxRating
                          ).toFixed(0)}
                          % Satisfied
                        </tspan>
                      </text>
                    );
                  }
                }}
              />
            </PolarRadiusAxis>
          </RadialBarChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}
