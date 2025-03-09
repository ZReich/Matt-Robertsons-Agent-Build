import { Card } from "@/components/ui/card"
import { CurrentPlanContent } from "./current-plan-content"
import { CurrentPlanFooter } from "./current-plan-footer"
import { CurrentPlanHeader } from "./current-plan-header"

export function CurrentPlan() {
  return (
    <Card className="w-full">
      <CurrentPlanHeader />
      <CurrentPlanContent />
      <CurrentPlanFooter />
    </Card>
  )
}
