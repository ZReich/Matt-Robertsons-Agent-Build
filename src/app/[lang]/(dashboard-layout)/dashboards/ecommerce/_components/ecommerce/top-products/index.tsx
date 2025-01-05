import { topProductsData } from "../../../_data/top-products";

import { DashboardCard } from "@/components/dashboard-card";
import { TopProductsList } from "./top-products-list";

export async function TopProducts() {
  return (
    <DashboardCard title="Top Products" period={topProductsData.period}>
      <TopProductsList data={topProductsData.products} />
    </DashboardCard>
  );
}
