"use client";

import { z } from "zod";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  LabelList,
} from "recharts";

import { chartConfig } from "@/configs/chart-config";

import { remToPx } from "@/lib/utils";

import { useSettings } from "@/hooks/use-settings";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";

const ProjectSchema = z.object({
  project_name: z.string(),
  progress: z.number().min(0).max(100),
  start_date: z.string().refine((date) => !isNaN(Date.parse(date)), {
    message: "Invalid date format for start_date",
  }),
  due_date: z.string().refine((date) => !isNaN(Date.parse(date)), {
    message: "Invalid date format for due_date",
  }),
  status: z.enum(["On Track", "At Risk", "On Hold"]),
  fill: z.string(),
});

type ActiveProject = z.infer<typeof ProjectSchema>;

export function ActiveProjects() {
  const { settings } = useSettings();

  const activeProjectsData: ActiveProject[] = [
    {
      project_name: "E-Commerce Platform Redesign",
      progress: 85,
      start_date: "2024-01-15",
      due_date: "2024-10-01",
      status: "On Track",
      fill: "hsl(var(--chart-1))",
    },
    {
      project_name: "Mobile App Development",
      progress: 60,
      start_date: "2024-03-10",
      due_date: "2024-09-30",
      status: "At Risk",
      fill: "hsl(var(--chart-2))",
    },
    {
      project_name: "Marketing Automation Setup",
      progress: 40,
      start_date: "2024-05-05",
      due_date: "2024-12-15",
      status: "On Hold",
      fill: "hsl(var(--chart-3))",
    },
    {
      project_name: "Cloud Migration",
      progress: 20,
      start_date: "2024-06-01",
      due_date: "2025-03-01",
      status: "On Track",
      fill: "hsl(var(--chart-4))",
    },
    {
      project_name: "Customer Support Portal Upgrade",
      progress: 90,
      start_date: "2023-12-01",
      due_date: "2024-08-15",
      status: "On Track",
      fill: "hsl(var(--chart-5))",
    },
    {
      project_name: "Sales Dashboard Enhancement",
      progress: 50,
      start_date: "2024-02-20",
      due_date: "2024-10-30",
      status: "At Risk",
      fill: "#457789",
    },
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle>Active Projects</CardTitle>
      </CardHeader>
      <CardContent>
        <ChartContainer config={chartConfig}>
          <BarChart
            accessibilityLayer
            data={activeProjectsData}
            layout="vertical"
            margin={{
              right: 16,
            }}
          >
            <CartesianGrid horizontal={false} />
            <YAxis
              dataKey="project_name"
              type="category"
              tickLine={false}
              tickMargin={10}
              axisLine={false}
              hide
            />
            <XAxis dataKey="progress" type="number" hide />
            <ChartTooltip
              cursor={false}
              content={<ChartTooltipContent indicator="line" />}
            />
            <Bar
              dataKey="progress"
              layout="vertical"
              radius={remToPx(settings.radius) - 4}
            >
              <LabelList
                dataKey="project_name"
                position="insideLeft"
                offset={8}
                className="fill-background"
                fontSize={12}
              />
              <LabelList
                dataKey="progress"
                position="right"
                offset={8}
                className="fill-foreground"
                fontSize={12}
              />
            </Bar>
          </BarChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}
