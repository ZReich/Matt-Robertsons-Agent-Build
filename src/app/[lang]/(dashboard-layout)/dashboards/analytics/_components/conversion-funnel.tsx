import { conversionFunnelData } from "../_data/conversion-funnel"

import {
  DashboardCard,
  DashboardCardActionsDropdown,
} from "@/components/dashboards/dashboard-card"
import { ConversionFunnelWrapper } from "./conversion-funnel-wrapper"

export async function ConversionFunnel() {
  return (
    <DashboardCard
      title="Conversion Funnel"
      period={conversionFunnelData.period}
      action={<DashboardCardActionsDropdown />}
    >
      <ConversionFunnelWrapper data={conversionFunnelData.funnelSteps} />
    </DashboardCard>
  )
}
