import { Overview } from "./overview";
import { TrafficSources } from "./traffic-sources";
import { EngagementByDevice } from "./engagement-by-device";
import { TopPages } from "./top-pages";
import { ConversionFunnel } from "./conversion-funnel";
import { PerformanceOverTime } from "./performance-over-time";

export function Analytics() {
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
