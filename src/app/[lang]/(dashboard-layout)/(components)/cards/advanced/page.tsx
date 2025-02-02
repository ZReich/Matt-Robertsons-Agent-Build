import type { Metadata } from "next";

import { ActiveProjects } from "../../../dashboards/crm/_components/crm/active-projects";
import { TopSalesRepresentatives } from "../../../dashboards/crm/_components/crm/top-sales-representatives";
import { CustomerSatisfaction } from "../../../dashboards/crm/_components/crm/customer-satisfaction";
import { TopProducts } from "../../../dashboards/ecommerce/_components/ecommerce/top-products";
import { TopPages } from "../../../dashboards/analytics/_components/analytics/top-pages";
import { SalesByCountry } from "../../../dashboards/crm/_components/crm/sales-by-country";

// Define metadata for the page
// More info: https://nextjs.org/docs/app/building-your-application/optimizing/metadata
export const metadata: Metadata = {
  title: "Advanced Cards",
};

export default function AdvancedCardsPage() {
  return (
    <section className="container grid gap-4 p-4 md:grid-cols-2">
      <ActiveProjects />
      <TopSalesRepresentatives />
      <CustomerSatisfaction />
      <TopProducts />
      <TopPages />
      <SalesByCountry />
    </section>
  );
}
