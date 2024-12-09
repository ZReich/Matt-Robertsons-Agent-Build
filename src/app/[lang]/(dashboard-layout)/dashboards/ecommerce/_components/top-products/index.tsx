import { topProductsData } from "../../_data/top-products";

import { DashboardCard } from "@/components/dashboard-card";
import { TopProductsCarousel } from "./top-products-carousel";

export async function TopProducts() {
  return (
    <DashboardCard title="Top Products" period="Last month">
      <TopProductsCarousel data={topProductsData} />
    </DashboardCard>
  );
}
