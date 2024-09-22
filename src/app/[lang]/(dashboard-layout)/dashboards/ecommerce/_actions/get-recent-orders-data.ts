"use server";

import { RecentOrderType } from "../_components/recent-orders";

export async function getRecentOrdersData(): Promise<RecentOrderType[]> {
  return [
    {
      id: 5,
      customer_name: "John Doe",
      date: 1694112000000,
      total_amount: { value: 8999, percentage_change: 0.05 },
      status: "Completed",
    },
    {
      id: 6,
      customer_name: "Sarah Lee",
      date: 1694112000000,
      total_amount: { value: 24575, percentage_change: -0.02 },
      status: "Pending",
    },
    {
      id: 7,
      customer_name: "James Smith",
      date: 1694025600000,
      total_amount: { value: 4999, percentage_change: 0.1 },
      status: "Completed",
    },
    {
      id: 8,
      customer_name: "Jessica Brown",
      date: 1694025600000,
      total_amount: { value: 15000, percentage_change: -0.01 },
      status: "Shipped",
    },
  ];
}
