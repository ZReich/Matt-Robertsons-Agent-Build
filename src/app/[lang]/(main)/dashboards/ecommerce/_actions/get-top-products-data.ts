"use server";

export async function getTopProductsData() {
  return [
    {
      id: "1",
      name: "Wireless Headphones",
      sales: { value: 85, percentage_change: 0.15 },
      revenue: { value: 340000, percentage_change: 0.1 },
      inventory_left: 30,
    },
    {
      id: "2",
      name: "Smart Watch",
      sales: { value: 72, percentage_change: 0.2 },
      revenue: { value: 576000, percentage_change: 0.12 },
      inventory_left: 25,
    },
    {
      id: "3",
      name: "Bluetooth Speaker",
      sales: { value: 54, percentage_change: -0.05 },
      revenue: { value: 162000, percentage_change: 0.08 },
      inventory_left: 50,
    },
    {
      id: "4",
      name: "Laptop Sleeve",
      sales: { value: 67, percentage_change: 0.1 },
      revenue: { value: 134000, percentage_change: 0.07 },
      inventory_left: 60,
    },
  ];
}
