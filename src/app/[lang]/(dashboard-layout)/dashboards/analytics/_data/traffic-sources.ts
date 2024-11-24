import { TrafficSourcesType } from "../types";

export const trafficSourcesData: TrafficSourcesType = {
  summary: { totalVisitors: 10000, totalPercentageChange: 0.7 },
  sources: [
    {
      name: "Direct",
      visitors: 4000,
      fill: "hsl(var(--chart-1))",
      percentageChange: 0.3,
    },
    {
      name: "Referral",
      visitors: 2500,
      fill: "hsl(var(--chart-2))",
      percentageChange: 0.25,
    },
    {
      name: "Social Media",
      visitors: 2000,
      fill: "hsl(var(--chart-3))",
      percentageChange: 0.2,
    },
    {
      name: "Search Engine",
      visitors: 1000,
      fill: "hsl(var(--chart-4))",
      percentageChange: -0.1,
    },
    {
      name: "Email",
      visitors: 500,
      fill: "hsl(var(--chart-5))",
      percentageChange: 0.05,
    },
  ],
};
