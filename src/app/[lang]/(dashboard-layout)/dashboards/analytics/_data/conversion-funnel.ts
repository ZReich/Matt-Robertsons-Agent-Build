import type { ConversionFunnelType } from "../types";

export const conversionFunnelData: ConversionFunnelType = [
  {
    name: "Visited Page",
    value: 15000,
    fill: `hsl(var(--chart-1))`,
  },
  {
    name: "Added to Cart",
    value: 5000,
    fill: `hsl(var(--chart-2))`,
  },
  {
    name: "Initiated Checkout",
    value: 1000,
    fill: `hsl(var(--chart-3))`,
  },
  {
    name: "Completed Purchase",
    value: 300,
    fill: `hsl(var(--chart-4))`,
  },
];
