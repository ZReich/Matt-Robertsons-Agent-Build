import { customerSatisfactionData } from "../../_data/customer-satisfaction";

import { DashboardCard } from "@/components/dashboard-card";
import { CustomerSatisfactionChart } from "./customer-satisfaction-cart";
import { CustomerSatisfactionCarousel } from "./customer-satisfaction-carousel";

export function CustomerSatisfaction() {
  return (
    <DashboardCard
      title="Customer Satisfaction"
      period={customerSatisfactionData.period}
    >
      <div className="flex flex-col justify-center items-center gap-6 md:flex-row">
        <CustomerSatisfactionChart data={customerSatisfactionData.summary} />
        <CustomerSatisfactionCarousel
          data={customerSatisfactionData.feedbacks}
        />
      </div>
    </DashboardCard>
  );
}
