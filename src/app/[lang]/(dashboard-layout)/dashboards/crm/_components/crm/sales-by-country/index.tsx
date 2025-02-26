import { salesByCountryData } from "../../../_data/sales-by-country";

import { SalesByCountryChart } from "./sales-by-country-chart";
import { DashboardCard } from "@/components/dashboards/dashboard-card";

export function SalesByCountry() {
  return (
    <DashboardCard title="Sales by Country" period={salesByCountryData.period}>
      <SalesByCountryChart data={salesByCountryData.countries} />
    </DashboardCard>
  );
}
