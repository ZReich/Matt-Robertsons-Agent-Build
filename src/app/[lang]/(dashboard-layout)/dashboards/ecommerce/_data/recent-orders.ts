import { RecentOrderType } from "../types";

export const recentOrdersData: RecentOrderType[] = [
  {
    id: '5',
    customerName: "John Doe",
    date: 1694112000000,
    totalAmount: { value: 8999, percentageChange: 0.05 },
    status: "Completed",
  },
  {
    id: '6',
    customerName: "Sarah Lee",
    date: 1694112000000,
    totalAmount: { value: 24575, percentageChange: -0.02 },
    status: "Pending",
  },
  {
    id: '7',
    customerName: "James Smith",
    date: 1694025600000,
    totalAmount: { value: 4999, percentageChange: 0.1 },
    status: "Completed",
  },
  {
    id: '8',
    customerName: "Jessica Brown",
    date: 1694025600000,
    totalAmount: { value: 15000, percentageChange: -0.01 },
    status: "Shipped",
  },
];
