import { genderDistributionData } from "../../../_data/gender-distribution";

import { GenderDistributionChart } from "./gender-distribution-chart";
import { DashboardCard } from "@/components/dashboards/dashboard-card";

export async function GenderDistribution() {
  return (
    <DashboardCard title="Gender Distribution">
      <GenderDistributionChart data={genderDistributionData} />
    </DashboardCard>
  );
}
