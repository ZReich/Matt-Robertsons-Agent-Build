import { newVsReturningVisitors } from "../../../_data/new-vs-returning-visitors";

import { DashboardCard } from "@/components/dashboards/dashboard-card";
import { NewVsReturningVisitorsChart } from "./new-vs-returning-visitors-chart";
import { NewVsReturningVisitorsList } from "./new-vs-returning-visitors-list";

export async function NewVsReturningVisitors() {
  return (
    <DashboardCard
      title="New vs. Returning Visitors"
      contentClassName="grid items-between gap-6"
    >
      <NewVsReturningVisitorsChart data={newVsReturningVisitors.visitors} />
      <NewVsReturningVisitorsList data={newVsReturningVisitors.visitors} />
    </DashboardCard>
  );
}
