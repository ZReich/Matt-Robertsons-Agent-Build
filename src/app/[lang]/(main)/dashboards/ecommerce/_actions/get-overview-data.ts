"use server";

export async function getOverviewData() {
  return {
    total_sales: {
      value: 1243000,
      percentage_change: 0.08,
    },
    revenue_summary: {
      value: 952000,
      percentage_change: 0.05,
    },
    number_of_orders: {
      value: 256,
      percentage_change: 0.12,
    },
    average_order_value: {
      value: 4648,
      percentage_change: -0.03,
    },
    sales_trend: [
      { date: 1693593600000, sales: 102000 },
      { date: 1693680000000, sales: 158000 },
      { date: 1693766400000, sales: 128000 },
      { date: 1693852800000, sales: 92000 },
      { date: 1693939200000, sales: 162000 },
      { date: 1694025600000, sales: 85000 },
      { date: 1694112000000, sales: 116000 },
    ],
  };
}
