import { newVsReturningVisitors } from "../../../_data/new-vs-returning-visitors";

import { DashboardCardWithoutPeriod } from "@/components/dashboards/dashboard-card";
import { NewVsReturningVisitorsChart } from "./new-vs-returning-visitors-chart";

export async function NewVsReturningVisitors() {
  return (
    <DashboardCardWithoutPeriod title="New vs. Returning Visitors">
      <NewVsReturningVisitorsChart data={newVsReturningVisitors.visitors} />
    </DashboardCardWithoutPeriod>
  );
}
