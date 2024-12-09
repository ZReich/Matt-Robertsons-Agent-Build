import { DashboardCardWithoutPeriod } from "@/components/dashboard-card";
import { activeProjectsData } from "../../_data/active-projects";
import { ActiveProjectsCarousel } from "./active-projects-carousel";

export function ActiveProjects() {
  return (
    <DashboardCardWithoutPeriod title="Active Projects">
      <div className="px-12">
        <ActiveProjectsCarousel data={activeProjectsData} />
      </div>
    </DashboardCardWithoutPeriod>
  );
}
