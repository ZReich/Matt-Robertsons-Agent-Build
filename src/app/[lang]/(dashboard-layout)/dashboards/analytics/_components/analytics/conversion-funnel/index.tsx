import { conversionFunnelData } from "../../../_data/conversion-funnel";

import { DashboardCard } from "@/components/dashboards/dashboard-card";
import { ConversionFunnelChart } from "./conversion-funnel-chart";

export async function ConversionFunnel() {
  return (
    <DashboardCard title="Conversion Funnel" period={conversionFunnelData.period}>
      <ConversionFunnelChart data={conversionFunnelData.funnelSteps} />
    </DashboardCard>
  );
}
