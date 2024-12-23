import {
  FileText,
  HandCoins,
  Timer,
  MousePointerIcon,
  RefreshCw,
  Sparkles,
  Users,
} from "lucide-react";

import { overviewData } from "../../_data/overview";

import { DashboardOverviewCard } from "@/components/dashboard-card";

export async function Overview() {
  return (
    <div className="grid grid-cols-2 gap-4 md:col-span-full md:grid-cols-4">
      <DashboardOverviewCard
        data={overviewData.totalVisitors}
        title="Total Visitors"
        period={overviewData.totalVisitors.period}
        icon={Users}
      />
      <DashboardOverviewCard
        data={overviewData.uniqueVisitors}
        title="Unique Visitors"
        period={overviewData.uniqueVisitors.period}
        icon={Sparkles}
      />
      <DashboardOverviewCard
        data={overviewData.totalPageViews}
        title="Total Page Views"
        period={overviewData.totalPageViews.period}
        icon={FileText}
      />
      <DashboardOverviewCard
        data={overviewData.averageSessionDuration}
        title="Avg. Session Duration"
        period={overviewData.averageSessionDuration.period}
        icon={Timer}
        formatStyle="duration"
      />
      <DashboardOverviewCard
        data={overviewData.bounceRate}
        title="Bounce Rate"
        period={overviewData.bounceRate.period}
        icon={MousePointerIcon}
        formatStyle="percent"
      />
      <DashboardOverviewCard
        data={overviewData.totalConversions}
        title="Total Conversions"
        period={overviewData.totalConversions.period}
        icon={RefreshCw}
      />
      <DashboardOverviewCard
        data={overviewData.conversionRate}
        title="Conversion Rate"
        period={overviewData.conversionRate.period}
        icon={RefreshCw}
        formatStyle="percent"
      />
      <DashboardOverviewCard
        data={overviewData.totalRevenue}
        title="Total Revenue"
        period={overviewData.totalRevenue.period}
        icon={HandCoins}
        formatStyle="currency"
      />
    </div>
  );
}
