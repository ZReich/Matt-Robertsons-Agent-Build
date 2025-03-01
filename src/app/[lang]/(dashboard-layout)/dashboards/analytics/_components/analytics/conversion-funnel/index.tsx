import { conversionFunnelData } from "../../../_data/conversion-funnel";

import {
  DashboardCard,
  DashboardCardActionsDropdown,
} from "@/components/dashboards/dashboard-card";
import { ConversionFunnelChart } from "./conversion-funnel-chart";

export async function ConversionFunnel() {
  return (
    <DashboardCard
      title="Conversion Funnel"
      period={conversionFunnelData.period}
      action={<DashboardCardActionsDropdown />}
    >
      <ConversionFunnelChart data={conversionFunnelData.funnelSteps} />
    </DashboardCard>
  );
}
