import { activityTimelineData } from "../../../_data/activity-timeline";

import { DashboardCard } from "@/components/dashboards/dashboard-card";
import { ActivityTimelineList } from "./activity-timeline-list";

export function ActivityTimeline() {
  return (
    <DashboardCard
      title="Activity Timeline"
      period={activityTimelineData.period}
    >
      <ActivityTimelineList data={activityTimelineData.activities} />
    </DashboardCard>
  );
}
