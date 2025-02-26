import { Overview } from "./overview";
import { TrafficSources } from "./traffic-sources";
import { EngagementByDevice } from "./engagement-by-device";
import { ConversionFunnel } from "./conversion-funnel";
import { PerformanceOverTime } from "./performance-over-time";
import { NewVsReturningVisitors } from "./new-vs-returning-visitors";
import { GenderDistribution } from "./gender-distribution";
import { VisitorsByCountry } from "./visitors-by-country";

export function Analytics() {
  return (
    <section className="container grid gap-4 p-4 md:grid-cols-2">
      <Overview />
      <TrafficSources />
      <div className="space-y-4">
        <ConversionFunnel />
        <div className="grid gap-4 sm:grid-cols-2">
          <GenderDistribution />
          <NewVsReturningVisitors />
        </div>
      </div>
      <PerformanceOverTime />
      <VisitorsByCountry />
      <EngagementByDevice />
    </section>
  );
}
