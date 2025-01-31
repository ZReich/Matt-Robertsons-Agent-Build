import type { Metadata } from "next";

import { ActiveProjects } from "../../../dashboards/crm/_components/crm/active-projects";
import { TopSalesRepresentatives } from "../../../dashboards/crm/_components/crm/top-sales-representatives";
import { CustomerSatisfaction } from "../../../dashboards/crm/_components/crm/customer-satisfaction";
import { TopProducts } from "../../../dashboards/ecommerce/_components/ecommerce/top-products";

// Define metadata for the page
// More info: https://nextjs.org/docs/app/building-your-application/optimizing/metadata
export const metadata: Metadata = {
  title: "Advance Cards",
};

export default function AdvanceCardsPage() {
  return (
    <section className="container grid gap-4 p-4 md:grid-cols-2">
      <ActiveProjects />
      <TopSalesRepresentatives />
      <CustomerSatisfaction />
      <TopProducts />
    </section>
  );
}
