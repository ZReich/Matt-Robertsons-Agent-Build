import { newVsReturningVisitors } from "../../../_data/new-vs-returning-visitors";

import { DashboardCard } from "@/components/dashboard-card";
import { NewVsReturningVisitorsChart } from "./new-vs-returning-visitors-chart";
import { Card, CardContent } from "@/components/ui/card";

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
