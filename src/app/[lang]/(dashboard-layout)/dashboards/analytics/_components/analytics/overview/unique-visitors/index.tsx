import { OverviewType } from "../../../../types";

import { DashboardOverviewCardV3 } from "@/components/dashboards/dashboard-card";
import { UniqueVisitorsChart } from "./unique-visitors-chart";

export function UniqueVisitors({
  data,
}: {
  data: OverviewType["uniqueVisitors"];
}) {
  return (
    <DashboardOverviewCardV3
      data={{
        value: data.averageValue,
        percentageChange: data.percentageChange,
      }}
      title="Unique Visitors"
      chart={<UniqueVisitorsChart data={data.perMonth} />}
    />
  );
}
