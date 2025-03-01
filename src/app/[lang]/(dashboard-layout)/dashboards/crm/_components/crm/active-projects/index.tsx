import { activeProjectsData } from "../../../_data/active-projects";

import { DashboardCard, DashboardCardActionsDropdown } from "@/components/dashboards/dashboard-card";
import { ActiveProjectsList } from "./active-projects-list";

export function ActiveProjects() {
  return (
    <DashboardCard
      title="Active Projects"
      action={<DashboardCardActionsDropdown />}
    >
      <ActiveProjectsList data={activeProjectsData} />
    </DashboardCard>
  );
}
