import { visitorsByCountryData } from "../../../_data/visitors-by-country";

import { DashboardCardWithoutPeriod } from "@/components/dashboards/dashboard-card";
import { VisitorsByCountryList } from "./visitors-by-country-list";

export function VisitorsByCountry() {
  return (
    <DashboardCardWithoutPeriod title="Visitors by Country">
      <VisitorsByCountryList data={visitorsByCountryData} />
    </DashboardCardWithoutPeriod>
  );
}
