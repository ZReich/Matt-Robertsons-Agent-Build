import { activeProjectsData } from "../../../_data/active-projects";

import { DashboardCardWithoutPeriod } from "@/components/dashboard-card";
import { ActiveProjectsList } from "./active-projects-list";

export function ActiveProjects() {
  return (
    <DashboardCardWithoutPeriod title="Active Projects">
      <ActiveProjectsList data={activeProjectsData} />
    </DashboardCardWithoutPeriod>
  );
}
