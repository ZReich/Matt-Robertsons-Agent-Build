"use client";

import { Bar, BarChart, XAxis, YAxis } from "recharts";

import { remToPx } from "@/lib/utils";

import type { NewVsReturningVisitorsType } from "../../../types";

import { useSettings } from "@/hooks/use-settings";
import { useIsRtl } from "@/hooks/use-is-rtl";

import { ChartContainer } from "@/components/ui/chart";

export function NewVsReturningVisitorsChart({
  data,
}: {
  data: NewVsReturningVisitorsType["visitors"];
}) {
  const { settings } = useSettings();
  const isRtl = useIsRtl();

  const radius = remToPx(settings.radius);
  // Transform `data` into an array format suitable for Recharts
  const chartData = [{ new: data.new.value, returning: data.returning.value }];
  // Determine the max value dynamically with a buffer
  const maxValue = Math.max(data.new.value, data.returning.value, 1) * 1.1;

  return (
    <ChartContainer config={{}} className="h-4 w-full">
      <BarChart
        data={chartData}
        layout="vertical"
        margin={{ top: 0, right: 0, left: 0, bottom: 0 }}
      >
        <XAxis type="number" reversed={isRtl} domain={[0, maxValue]} hide />
        <YAxis type="category" hide />
        <Bar dataKey="new" stackId="a" fill={data.new.fill} radius={radius} />
        <Bar
          dataKey="returning"
          stackId="a"
          fill={data.returning.fill}
          radius={radius}
        />
      </BarChart>
    </ChartContainer>
  );
}
