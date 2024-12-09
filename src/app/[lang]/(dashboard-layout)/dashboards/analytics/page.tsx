import type { Metadata } from "next";

import { Overview } from "./_components/overview";
import { TrafficSources } from "./_components/traffic-sources";
import { EngagementByDevice } from "./_components/engagement-by-device";
import { TopPages } from "./_components/top-pages";
import { ConversionFunnel } from "./_components/conversion-funnel";
import { PerformanceOverTime } from "./_components/performance-over-time";

// Define metadata for the page
// More info: https://nextjs.org/docs/app/building-your-application/optimizing/metadata
export const metadata: Metadata = {
  title: "Analytics",
};

export default function AnalyticsPage() {
  return (
    <section className="container grid gap-4 p-4 md:grid-cols-2">
      <Overview />
      <ConversionFunnel />
      <TrafficSources />
      <TopPages />
      <PerformanceOverTime />
      <EngagementByDevice />
    </section>
  );
}
