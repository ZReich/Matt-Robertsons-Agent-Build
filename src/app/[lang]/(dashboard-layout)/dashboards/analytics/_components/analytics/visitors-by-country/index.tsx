import { visitorsByCountryData } from "../../../_data/visitors-by-country";

import { DashboardCard, DashboardCardActionsDropdown } from "@/components/dashboards/dashboard-card";
import { VisitorsByCountryList } from "./visitors-by-country-list";

export function VisitorsByCountry() {
  return (
    <DashboardCard
      title="Visitors by Country"
      action={<DashboardCardActionsDropdown />}
    >
      <VisitorsByCountryList data={visitorsByCountryData} />
    </DashboardCard>
  );
}
