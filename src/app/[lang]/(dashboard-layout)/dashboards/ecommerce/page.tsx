import { CustomerInsights } from "./_components/customer-insights";
import { Overview } from "./_components/overview";
import { RecentOrders } from "./_components/recent-orders";
import { TopProducts } from "./_components/top-products";

export default function EcommercePage() {
  return (
    <div className="container grid gap-4 p-4 md:grid-cols-2">
      <Overview />
      <TopProducts />
      <RecentOrders />
      <CustomerInsights />
    </div>
  );
}
