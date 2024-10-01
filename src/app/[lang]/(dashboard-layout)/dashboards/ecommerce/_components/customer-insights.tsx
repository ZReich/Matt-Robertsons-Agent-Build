import { z } from "zod";

import { getCustomerInsightsData } from "../_actions/get-customer-insights-data";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, UserPlus, Crown, UserCheck } from "lucide-react";

export const CustomerInsightsSchema = z.object({
  total_customers: z.number().nonnegative(),
  new_customers: z.number().nonnegative(),
  returning_customers: z.number().nonnegative(),
  vip_customers: z.number().nonnegative(),
});

export type CustomerInsightsType = z.infer<typeof CustomerInsightsSchema>;

export async function CustomerInsights() {
  const customerInsightsData: CustomerInsightsType =
    await getCustomerInsightsData();

  return (
    <Card className="col-span-full">
      <CardHeader>
        <CardTitle>Customer Insights</CardTitle>
      </CardHeader>
      <CardContent className="grid grid-cols-4 gap-3">
        <CustomerInsightsCard
          label="Total"
          value={customerInsightsData.total_customers.toLocaleString()}
          icon={Users}
        />
        <CustomerInsightsCard
          label="New"
          value={customerInsightsData.new_customers.toLocaleString()}
          icon={UserPlus}
        />
        <CustomerInsightsCard
          label="Returning"
          value={customerInsightsData.returning_customers.toLocaleString()}
          icon={UserCheck}
        />
        <CustomerInsightsCard
          label="VIP"
          value={customerInsightsData.vip_customers.toLocaleString()}
          icon={Crown}
        />
      </CardContent>
    </Card>
  );
}

interface CustomerInsightsCardProps {
  label: string;
  value: string;
  icon: React.ElementType;
}

function CustomerInsightsCard({
  label,
  value,
  icon: Icon,
}: CustomerInsightsCardProps) {
  return (
    <div className="relative rounded-lg border bg-card text-card-foreground p-6">
      <h4>{label}</h4>
      <p className="font-bold text-4xl">{value}</p>
      <Icon className="absolute bottom-0 end-3 size-16 text-foreground opacity-10 md:size-24" />
    </div>
  );
}
