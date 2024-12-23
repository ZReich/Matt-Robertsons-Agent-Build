import { Overview } from "./overview";
import { SalesPipeline } from "./sales-pipeline";
import { LeadSources } from "./lead-sources";
import { CustomerSatisfaction } from "./customer-satisfaction";
import { ActiveProjects } from "./active-projects";
import { RevenueTrend } from "./revenue-trend";
import { SalesByCountry } from "./sales-by-country";
import { TopSalesRepresentatives } from "./top-sales-representatives";

export function CRM() {
  return (
    <section className="container grid gap-4 p-4 md:grid-cols-2">
      <Overview />
      <SalesPipeline />
      <TopSalesRepresentatives />
      <LeadSources />
      <CustomerSatisfaction />
      <ActiveProjects />
      <RevenueTrend />
      <SalesByCountry />
    </section>
  );
}
