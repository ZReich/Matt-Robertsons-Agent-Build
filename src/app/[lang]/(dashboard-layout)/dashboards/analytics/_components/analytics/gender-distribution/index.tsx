import { genderDistributionData } from "../../../_data/gender-distribution";

import { GenderDistributionChart } from "./gender-distribution-chart";
import { DashboardCardWithoutPeriod } from "@/components/dashboards/dashboard-card";

export async function GenderDistribution() {
  return (
    <DashboardCardWithoutPeriod title="Gender Distribution">
      <GenderDistributionChart data={genderDistributionData} />
    </DashboardCardWithoutPeriod>
  );
}
