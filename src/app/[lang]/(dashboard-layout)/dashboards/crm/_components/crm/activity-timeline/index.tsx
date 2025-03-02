import { activityTimelineData } from "../../../_data/activity-timeline";

import { DashboardCard } from "@/components/dashboards/dashboard-card";
import { ActivityTimelineList } from "./activity-timeline-list";
import { DatePicker } from "@/components/date-picker";

export function ActivityTimeline() {
  return (
    <DashboardCard
      title="Activity Timeline"
      period={activityTimelineData.period}
      action={
        <DatePicker
          value={new Date()}
          buttonClassName="w-9 [&_>_svg]:text-foreground [&_>_span]:hidden"
          buttonOptions={{ size: "icon" }}
          popoverContentOptions={{ align: "end" }}
        />
      }
    >
      <ActivityTimelineList data={activityTimelineData.activities} />
    </DashboardCard>
  );
}
