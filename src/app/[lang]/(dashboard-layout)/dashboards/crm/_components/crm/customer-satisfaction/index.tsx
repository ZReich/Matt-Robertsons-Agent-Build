import { customerSatisfactionData } from "../../../_data/customer-satisfaction";

import { DashboardCard, DashboardCardActionsDropdown } from "@/components/dashboards/dashboard-card";
import { CustomerSatisfactionChart } from "./customer-satisfaction-chart";
import { CustomerSatisfactionCarousel } from "./customer-satisfaction-carousel";

export function CustomerSatisfaction() {
  return (
    <DashboardCard
      title="Customer Satisfaction"
      period={customerSatisfactionData.period}
      action={<DashboardCardActionsDropdown />}
      className="col-span-full"

    >
      <div className="flex flex-col justify-between items-center gap-6 md:flex-row">
        <CustomerSatisfactionChart data={customerSatisfactionData.summary} />
        <CustomerSatisfactionCarousel
          data={customerSatisfactionData.feedbacks}
        />
      </div>
    </DashboardCard>
  );
}
