import { salesByCountryData } from "../../../_data/sales-by-country";

import { ScrollArea } from "@/components/ui/scroll-area";
import { SalesByCountryTable } from "./sales-by-country.table";
import { DashboardCard } from "@/components/dashboard-card";

export function SalesByCountry() {
  return (
    <DashboardCard title="Sales by Country" period={salesByCountryData.period}>
      <SalesByCountryTable data={salesByCountryData.countries} />
    </DashboardCard>
  );
}
