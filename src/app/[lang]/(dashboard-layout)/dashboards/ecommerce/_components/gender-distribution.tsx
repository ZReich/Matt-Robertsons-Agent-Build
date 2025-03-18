import { genderDistributionData } from "../_data/gender-distribution"

import { DashboardCard } from "@/components/dashboards/dashboard-card"
import { GenderDistributionChart } from "./gender-distribution-chart"

export async function GenderDistribution() {
  return (
    <DashboardCard title="Gender Distribution" contentClassName="p-0" size="xs">
      <GenderDistributionChart data={genderDistributionData} />
    </DashboardCard>
  )
}
