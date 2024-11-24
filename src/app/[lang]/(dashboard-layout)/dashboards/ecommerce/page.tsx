import { CustomerInsights } from "./_components/customer-insights";
import { Overview } from "./_components/overview";
import { SalesTrend } from "./_components/sales-trend";
import { TopProducts } from "./_components/top-products";
import { Invoices } from "./_components/invoices";

export default function EcommercePage() {
  return (
    <section className="container grid gap-4 p-4 md:grid-cols-2">
      <Overview />
      <SalesTrend />
      <TopProducts />
      <CustomerInsights />
      <Invoices />
    </section>
  );
}
