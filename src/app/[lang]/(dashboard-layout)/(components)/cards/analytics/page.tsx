import type { Metadata } from "next";

import { ConversionFunnel } from "../../../dashboards/analytics/_components/analytics/conversion-funnel";
import { PerformanceOverTime } from "../../../dashboards/analytics/_components/analytics/performance-over-time";
import { TrafficSources } from "../../../dashboards/analytics/_components/analytics/traffic-sources";
import { SalesPipeline } from "../../../dashboards/crm/_components/crm/sales-pipeline";
import { RevenueTrend } from "../../../dashboards/crm/_components/crm/revenue-trend";
import { SalesTrend } from "../../../dashboards/ecommerce/_components/ecommerce/sales-trend";

// Define metadata for the page
// More info: https://nextjs.org/docs/app/building-your-application/optimizing/metadata
export const metadata: Metadata = {
  title: "Analytics Cards",
};

export default function AnalyticsCardsPage() {
  return (
    <section className="container grid gap-4 p-4 md:grid-cols-2">
      <ConversionFunnel />
      <PerformanceOverTime />
      <TrafficSources />
      <SalesPipeline />
      <RevenueTrend />
      <SalesTrend />
    </section>
  );
}
