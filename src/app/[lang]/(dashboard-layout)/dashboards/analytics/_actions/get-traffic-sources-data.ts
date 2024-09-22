"use server";

export async function getTrafficSourcesData() {
  return [
    {
      source: "Direct",
      visitors: 4000,
      fill: "hsl(var(--chart-1))",
    },
    {
      source: "Referral",
      visitors: 2500,
      fill: "hsl(var(--chart-2))",
    },
    {
      source: "Social Media",
      visitors: 2000,
      fill: "hsl(var(--chart-2))",
    },
    {
      source: "Search Engine",
      visitors: 1000,
      fill: "hsl(var(--chart-3))",
    },
    {
      source: "Email",
      visitors: 500,
      fill: "hsl(var(--chart-4))",
    },
  ];
}
