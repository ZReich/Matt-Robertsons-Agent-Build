import { genderDistributionData } from "../../../_data/gender-distribution";

import { GenderDistributionChart } from "./gender-distribution-chart";
import { DashboardCard } from "@/components/dashboard-card";

export async function GenderDistribution() {
  return (
    <DashboardCard title="Gender Distribution" period="Last month">
      <GenderDistributionChart data={genderDistributionData} />
    </DashboardCard>
  );
}
