import { CustomerInsights } from "./customer-insights";
import { Overview } from "./overview";
import { SalesTrend } from "./sales-trend";
import { TopProducts } from "./top-products";
import { Invoices } from "./invoices";

export function Ecommerce() {
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
