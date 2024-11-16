import { Overview } from "./_components/overview";
import { TrafficSources } from "./_components/traffic-sources";
import { GeographicLocation } from "./_components/geographic-location";
import { EngagementByDevice } from "./_components/engagement-by-device";
import { TopPages } from "./_components/top-pages";
import { ConversionFunnel } from "./_components/conversion-funnel";
import { PerformanceOverTime } from "./_components/performance-over-time";
import { WeeklyTrafficOverview } from "./_components/weekly-traffic-overview";
import { MonthlyConversionSummary } from "./_components/monthly-conversion-summary";

export default function AnalyticsPage() {
  return (
    <section className="container grid gap-4 p-4">
      <Overview />
      <TrafficSources />
      <GeographicLocation />
      <EngagementByDevice />
      <TopPages />
      <ConversionFunnel />
      <PerformanceOverTime />
      <WeeklyTrafficOverview />
      <MonthlyConversionSummary />
    </section>
  );
}
