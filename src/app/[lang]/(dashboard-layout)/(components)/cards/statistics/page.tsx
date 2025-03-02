import type { Metadata } from "next";

import { Overview } from "../../../dashboards/crm/_components/crm/overview";
import { Overview as OverviewV2 } from "../../../dashboards/ecommerce/_components/ecommerce/overview";
import { Overview as OverviewV3 } from "../../../dashboards/analytics/_components/analytics/overview";
import { NewVsReturningVisitors } from "../../../dashboards/analytics/_components/analytics/new-vs-returning-visitors";
import { GenderDistribution } from "../../../dashboards/analytics/_components/analytics/gender-distribution";
import { CustomerInsights } from "../../../dashboards/ecommerce/_components/ecommerce/customer-insights";
import { RevenueTrend } from "../../../dashboards/crm/_components/crm/revenue-trend";
import { LeadSources } from "../../../dashboards/crm/_components/crm/lead-sources";

// Define metadata for the page
// More info: https://nextjs.org/docs/app/building-your-application/optimizing/metadata
export const metadata: Metadata = {
  title: "Statistics Cards",
};

export default function StatisticsCardsPage() {
  return (
    <section className="container grid gap-4 p-4 md:grid-cols-2">
      <Overview />
      <OverviewV2 />
      <OverviewV3 />
      <RevenueTrend />
      <LeadSources />
      <NewVsReturningVisitors />
      <GenderDistribution />
      <CustomerInsights />
    </section>
  );
}
