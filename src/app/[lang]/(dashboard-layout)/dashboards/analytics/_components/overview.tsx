import {
  FileText,
  HandCoins,
  Timer,
  MousePointerIcon,
  RefreshCw,
  Sparkles,
  Users,
} from "lucide-react";

import { overviewData } from "../_data/overview";

import { OverviewCard } from "@/components/overview-card";

export async function Overview() {
  return (
    <div className="grid grid-cols-2 gap-4 md:col-span-full md:grid-cols-4">
      <OverviewCard
        data={overviewData.totalVisitors}
        title="Total Visitors"
        description="Last month"
        icon={Users}
      />
      <OverviewCard
        data={overviewData.uniqueVisitors}
        title="Unique Visitors"
        description="Last month"
        icon={Sparkles}
      />
      <OverviewCard
        data={overviewData.totalPageViews}
        title="Total Page Views"
        description="Last month"
        icon={FileText}
      />
      <OverviewCard
        data={overviewData.averageSessionDuration}
        title="Avg. Session Duration"
        description="Last month"
        icon={Timer}
        formatStyle="duration"
      />
      <OverviewCard
        data={overviewData.bounceRate}
        title="Bounce Rate"
        description="Last month"
        icon={MousePointerIcon}
        formatStyle="percent"
      />
      <OverviewCard
        data={overviewData.totalConversions}
        title="Total Conversions"
        description="Last month"
        icon={RefreshCw}
      />
      <OverviewCard
        data={overviewData.conversionRate}
        title="Conversion Rate"
        description="Last month"
        icon={RefreshCw}
        formatStyle="percent"
      />
      <OverviewCard
        data={overviewData.totalRevenue}
        title="Total Revenue"
        description="Last month"
        icon={HandCoins}
        formatStyle="currency"
      />
    </div>
  );
}
