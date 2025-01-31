import type { Metadata } from "next";

import { Overview } from "../../../dashboards/crm/_components/crm/overview";
import { Overview as OverviewV2 } from "../../../dashboards/ecommerce/_components/ecommerce/overview";
import StatsCards from "./stats-card";

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
      {/* <StatsCards /> */}
    </section>
  );
}
