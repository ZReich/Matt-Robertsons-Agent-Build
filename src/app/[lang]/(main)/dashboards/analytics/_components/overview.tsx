import { z } from "zod";
import {
  FileText,
  HandCoins,
  Hourglass,
  Lightbulb,
  MousePointerIcon,
  Target,
  User,
  Users,
} from "lucide-react";

import { getOverviewData } from "../_actions/get-overview-data";

import { OverviewCard } from "@/components/OverviewCard";

export const MetricSchema = z.object({
  value: z.number(),
  percentage_change: z.number(),
});

export const OverviewSchema = z.object({
  total_visitors: MetricSchema,
  unique_visitors: MetricSchema,
  total_page_views: MetricSchema,
  average_session_duration: MetricSchema,
  bounce_rate: MetricSchema,
  total_conversions: MetricSchema,
  conversion_rate: MetricSchema,
  total_revenue: MetricSchema,
});

export type OverviewType = z.infer<typeof OverviewSchema>;

export async function Overview() {
  const overviewData: OverviewType = await getOverviewData();

  return (
    <div className="grid grid-cols-2 gap-4 md:col-span-2 md:grid-cols-4">
      <OverviewCard
        data={overviewData.total_visitors}
        title="Total Visitors"
        description="Last month"
        icon={Users}
      />
      <OverviewCard
        data={overviewData.unique_visitors}
        title="Unique Visitors"
        description="Last month"
        icon={User}
      />
      <OverviewCard
        data={overviewData.total_page_views}
        title="Total Page Views"
        description="Last month"
        icon={FileText}
      />
      <OverviewCard
        data={overviewData.average_session_duration}
        title="Avg. Session Duration"
        description="Last month"
        icon={Hourglass}
        formatStyle="duration"
      />
      <OverviewCard
        data={overviewData.bounce_rate}
        title="Bounce Rate"
        description="Last month"
        icon={MousePointerIcon}
        formatStyle="percent"
      />
      <OverviewCard
        data={overviewData.total_conversions}
        title="Total Conversions"
        description="Last month"
        icon={Target}
      />
      <OverviewCard
        data={overviewData.conversion_rate}
        title="Conversion Rate"
        description="Last month"
        icon={Lightbulb}
        formatStyle="percent"
      />
      <OverviewCard
        data={overviewData.total_revenue}
        title="Total Revenue"
        description="Last month"
        icon={HandCoins}
        formatStyle="currency"
      />
    </div>
  );
}
