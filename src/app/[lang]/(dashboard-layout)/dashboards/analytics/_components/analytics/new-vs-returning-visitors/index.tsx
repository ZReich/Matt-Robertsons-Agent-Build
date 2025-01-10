import { newVsReturningVisitors } from "../../../_data/new-vs-returning-visitors";

import { DashboardCard } from "@/components/dashboards/dashboard-card";
import { NewVsReturningVisitorsChart } from "./new-vs-returning-visitors-chart";

export async function NewVsReturningVisitors() {
  return (
    <DashboardCard
      title="New vs Returning Visitors"
      period={newVsReturningVisitors.period}
    >
      <NewVsReturningVisitorsChart data={newVsReturningVisitors.visitors} />
    </DashboardCard>
  );
}
