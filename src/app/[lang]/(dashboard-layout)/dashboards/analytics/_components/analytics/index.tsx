import { Overview } from "./overview";
import { TrafficSources } from "./traffic-sources";
import { EngagementByDevice } from "./engagement-by-device";
import { TopPages } from "./top-pages";
import { ConversionFunnel } from "./conversion-funnel";
import { PerformanceOverTime } from "./performance-over-time";
import { NewVsReturningVisitors } from "./new-vs-returning-visitors";
import { GenderDistribution } from "./gender-distribution";

export function Analytics() {
  return (
    <section className="container grid gap-4 p-4 md:grid-cols-2">
      <Overview />
      <ConversionFunnel />
      <PerformanceOverTime />
      <TrafficSources />
      <TopPages />
      <div className="space-y-4">
        <NewVsReturningVisitors />
        <GenderDistribution />
      </div>
      <EngagementByDevice />
    </section>
  );
}
