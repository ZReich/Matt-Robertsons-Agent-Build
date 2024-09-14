"use server";

export async function getMonthlyConversionSummaryData() {
  return [
    { month: "January", conversions: 30, revenue: 1200 },
    { month: "February", conversions: 40, revenue: 1600 },
    { month: "March", conversions: 50, revenue: 2000 },
  ];
}
