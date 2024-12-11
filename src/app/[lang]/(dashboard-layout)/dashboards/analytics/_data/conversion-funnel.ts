import type { ConversionFunnelType } from "../types";

export const conversionFunnelData: ConversionFunnelType = {
  period: "Last month",
  funnelSteps: [
    {
      name: "Visited Page",
      value: 15000,
      fill: `hsl(var(--chart-1))`,
      iconName: "Eye",
    },
    {
      name: "Added to Cart",
      value: 5000,
      fill: `hsl(var(--chart-2))`,
      iconName: "ShoppingCart",
    },
    {
      name: "Initiated Checkout",
      value: 1000,
      fill: `hsl(var(--chart-3))`,
      iconName: "CreditCard",
    },
    {
      name: "Completed Purchase",
      value: 300,
      fill: `hsl(var(--chart-4))`,
      iconName: "Check",
    },
  ],
};
