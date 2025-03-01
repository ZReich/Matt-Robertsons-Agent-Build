import { activityTimelineData } from "../../../_data/activity-timeline";

import { DashboardCard, DashboardCardActionsDropdown } from "@/components/dashboards/dashboard-card";
import { ActivityTimelineList } from "./activity-timeline-list";

export function ActivityTimeline() {
  return (
    <DashboardCard
      title="Activity Timeline"
      period={activityTimelineData.period}
      action={<DashboardCardActionsDropdown />}
    >
      <ActivityTimelineList data={activityTimelineData.activities} />
    </DashboardCard>
  );
}
