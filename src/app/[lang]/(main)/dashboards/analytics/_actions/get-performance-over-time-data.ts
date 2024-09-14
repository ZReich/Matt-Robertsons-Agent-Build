"use server";

export async function getPerformanceOverTimeData() {
  return [
    { month: "January", visitors: 1200, conversions: 30 },
    { month: "February", visitors: 1400, conversions: 40 },
    { month: "March", visitors: 1600, conversions: 50 },
    { month: "April", visitors: 1500, conversions: 45 },
    { month: "May", visitors: 1800, conversions: 60 },
  ];
}