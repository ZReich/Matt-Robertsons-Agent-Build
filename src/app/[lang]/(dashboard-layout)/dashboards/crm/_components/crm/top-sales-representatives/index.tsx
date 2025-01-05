import { salesRepresentativeData } from "../../../_data/top-sales-representatives";

import { TopSalesRepresentativesList } from "./top-sales-representatives-list";
import { DashboardCard } from "@/components/dashboard-card";

export function TopSalesRepresentatives() {
  return (
    <DashboardCard
      title="Top Sales Representatives"
      period={salesRepresentativeData.period}
    >
      <TopSalesRepresentativesList
        data={salesRepresentativeData.representatives}
      />
    </DashboardCard>
  );
}
