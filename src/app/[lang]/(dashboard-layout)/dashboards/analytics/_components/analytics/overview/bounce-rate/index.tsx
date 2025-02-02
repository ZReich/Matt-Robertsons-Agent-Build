import { OverviewType } from "../../../../types";

import { DashboardOverviewCardV3 } from "@/components/dashboards/dashboard-card";
import { BounceRateChart } from "./bounce-rate-chart";

export function BounceRate({ data }: { data: OverviewType["bounceRate"] }) {
  return (
    <DashboardOverviewCardV3
      data={{
        value: data.averageValue,
        percentageChange: data.percentageChange,
      }}
      title="Bounce Rate"
      chart={<BounceRateChart data={data.perMonth} />}
      formatStyle="percent"
    />
  );
}
