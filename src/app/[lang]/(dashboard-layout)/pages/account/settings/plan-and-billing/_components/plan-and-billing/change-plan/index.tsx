import { plansData } from "../../../../../_data/plans";
import { subscriptionsData } from "../../../../../_data/subscriptions";

import { Card } from "@/components/ui/card";
import { ChangePlanHeader } from "./change-plan-header";
import { ChangePlanContent } from "./change-plan-content";

export function ChangePlan() {
  return (
    <Card>
      <ChangePlanHeader />
      <ChangePlanContent plans={plansData} subscriptions={subscriptionsData} />
    </Card>
  );
}
