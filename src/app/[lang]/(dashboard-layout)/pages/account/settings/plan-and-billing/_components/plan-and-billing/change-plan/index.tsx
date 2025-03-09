import { plansData } from "../../../../../_data/plans"
import { subscriptionsData } from "../../../../../_data/subscriptions"

import { Card } from "@/components/ui/card"
import { ChangePlanContent } from "./change-plan-content"
import { ChangePlanHeader } from "./change-plan-header"

export function ChangePlan() {
  return (
    <Card>
      <ChangePlanHeader />
      <ChangePlanContent plans={plansData} subscriptions={subscriptionsData} />
    </Card>
  )
}
