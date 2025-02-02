import type { OverviewType } from "../types";

export const overviewData: OverviewType = {
  uniqueVisitors: {
    averageValue: 15091.67,
    percentageChange: 0.07,
    perMonth: [
      { month: "Jan", value: 12000 },
      { month: "Feb", value: 16000 },
      { month: "Mar", value: 15050 },
      { month: "Apr", value: 14000 },
      { month: "May", value: 17500 },
      { month: "Jun", value: 16000 },
    ],
  },
  averageSessionDuration: {
    averageValue: 73333.33,
    percentageChange: -0.04,
    perMonth: [
      { month: "Jan", value: 110000, fill: "hsl(var(--chart-1))" },
      { month: "Feb", value: -90000, fill: "hsl(var(--chart-2))" },
      { month: "Mar", value: 220000, fill: "hsl(var(--chart-1))" },
      { month: "Apr", value: -130000, fill: "hsl(var(--chart-2))" },
      { month: "May", value: 135000, fill: "hsl(var(--chart-1))" },
      { month: "Jun", value: 195000, fill: "hsl(var(--chart-1))" },
    ],
  },
  bounceRate: {
    averageValue: 0.5933,
    percentageChange: 0.05,
    perMonth: [
      { month: "Jan", value: 0.12 },
      { month: "Feb", value: 0.55 },
      { month: "Mar", value: 0.68 },
      { month: "Apr", value: 0.48 },
      { month: "May", value: 0.7 },
      { month: "Jun", value: 0.53 },
    ],
  },
  conversionRate: {
    averageValue: 0.5628,
    percentageChange: 0.006,
    perMonth: [
      { month: "Jan", value: 0.54 },
      { month: "Feb", value: 0.49 },
      { month: "Mar", value: 0.452 },
      { month: "Apr", value: 0.42 },
      { month: "May", value: 0.505 },
      { month: "Jun", value: 0.47 },
    ],
  },
};
