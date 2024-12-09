import { conversionFunnelData } from "../../_data/conversion-funnel";

import { DashboardCard } from "@/components/dashboard-card";
import { ConversionFunnelChart } from "./conversion-funnel-chart";

export async function ConversionFunnel() {
  return (
    <DashboardCard title="Conversion Funnel" period="Last month">
      <ConversionFunnelChart data={conversionFunnelData} />
    </DashboardCard>
  );
}
