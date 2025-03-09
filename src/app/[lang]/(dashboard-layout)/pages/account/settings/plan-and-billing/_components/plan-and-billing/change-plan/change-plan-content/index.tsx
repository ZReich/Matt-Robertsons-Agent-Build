import type { PlanType, SubscriptionType } from "../../../../../../types"

import { CardContent } from "@/components/ui/card"
import { ChangePlanForm } from "./change-plan-form"

export function ChangePlanContent({
  plans,
  subscriptions,
}: {
  plans: PlanType[]
  subscriptions: SubscriptionType[]
}) {
  return (
    <CardContent>
      <ChangePlanForm plans={plans} subscriptions={subscriptions} />
    </CardContent>
  )
}
