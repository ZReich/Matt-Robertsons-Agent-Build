import { ChurnRate } from "./churn-rate"
import { CustomerInsights } from "./customer-insights"
import { Invoices } from "./invoices"
import { Overview } from "./overview"
import { RevenueBySource } from "./revenue-by-source"
import { SalesTrend } from "./sales-trend"
import { TopProducts } from "./top-products"

export function Ecommerce() {
  return (
    <section className="container grid gap-4 p-4 md:grid-cols-2">
      <Overview />
      <ChurnRate />
      <RevenueBySource />
      <CustomerInsights />
      <SalesTrend />
      <TopProducts />
      <Invoices />
    </section>
  )
}
