import type { TopProductType } from "../types";

export const topProductsData: TopProductType[] = [
  {
    name: "Wireless Headphones",
    sku: "WH-001",
    sales: { value: 85, percentageChange: 0.15 },
    revenue: { value: 340000, percentageChange: 0.1 },
    inventoryLeft: 30,
    image: "/images/wireless-headphones.jpeg",
  },
  {
    name: "Smart Watch",
    sku: "SW-002",
    sales: { value: 72, percentageChange: 0.2 },
    revenue: { value: 576000, percentageChange: 0.12 },
    inventoryLeft: 25,
    image: "/images/smart-watch.jpeg",
  },
  {
    name: "Bluetooth Speaker",
    sku: "BS-003",
    sales: { value: 54, percentageChange: -0.05 },
    revenue: { value: 162000, percentageChange: 0.08 },
    inventoryLeft: 50,
    image: "/images/bluetooth-speaker.jpeg",
  },
  {
    name: "Laptop Sleeve",
    sku: "LS-004",
    sales: { value: 67, percentageChange: 0.1 },
    revenue: { value: 134000, percentageChange: 0.07 },
    inventoryLeft: 60,
    image: "/images/laptop-sleeve.jpeg",
  },
  {
    name: "Portable Charger",
    sku: "PC-005",
    sales: { value: 49, percentageChange: 0.18 },
    revenue: { value: 98000, percentageChange: 0.09 },
    inventoryLeft: 40,
    image: "/images/portable-charger.jpeg",
  },
];
