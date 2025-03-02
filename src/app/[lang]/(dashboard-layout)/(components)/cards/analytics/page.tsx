import type { Metadata } from "next";

import { ConversionFunnel } from "../../../dashboards/analytics/_components/analytics/conversion-funnel";
import { PerformanceOverTime } from "../../../dashboards/analytics/_components/analytics/performance-over-time";
import { TrafficSources } from "../../../dashboards/analytics/_components/analytics/traffic-sources";
import { SalesTrend as SalesTrendV2 } from "../../../dashboards/ecommerce/_components/ecommerce/sales-trend";
import { SalesByCountry } from "../../../dashboards/crm/_components/crm/sales-by-country";
import { SalesTrend } from "../../../dashboards/crm/_components/crm/sales-trend";
import { ChurnRate } from "../../../dashboards/ecommerce/_components/ecommerce/churn-rate";
import { RevenueBySource } from "../../../dashboards/ecommerce/_components/ecommerce/revenue-by-source";

// Define metadata for the page
// More info: https://nextjs.org/docs/app/building-your-application/optimizing/metadata
export const metadata: Metadata = {
  title: "Analytics Cards",
};

export default function AnalyticsCardsPage() {
  return (
    <section className="container grid gap-4 p-4 md:grid-cols-2">
      <div className="col-span-full">
        <SalesTrend />
      </div>
      <TrafficSources />
      <SalesTrendV2 />
      <PerformanceOverTime />
      <SalesByCountry />
      <ChurnRate />
      <RevenueBySource />
      <ConversionFunnel />
    </section>
  );
}
