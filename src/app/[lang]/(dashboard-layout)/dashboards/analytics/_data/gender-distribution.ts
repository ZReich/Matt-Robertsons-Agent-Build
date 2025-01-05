import { GenderDistributionType } from "../types";

export const genderDistributionData: GenderDistributionType[] = [
  {
    name: "Male",
    value: 12500,
    percentage: 0.5,
    fill: "hsl(var(--chart-1))",
  },
  {
    name: "Female",
    value: 12000,
    percentage: 0.48,
    fill: "hsl(var(--chart-2))",
  },
  {
    name: "Other",
    value: 500,
    percentage: 0.02,
    fill: "hsl(var(--chart-3))",
  },
];
