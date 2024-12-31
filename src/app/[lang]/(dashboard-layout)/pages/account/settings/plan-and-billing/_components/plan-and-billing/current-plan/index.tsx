import { Card } from "@/components/ui/card";
import { CurrentPlanHeader } from "./current-plan-header";
import { CurrentPlanContent } from "./current-plan-content";
import { CurrentPlanFooter } from "./current-plan-footer";

export function CurrentPlan() {
  return (
    <Card className="w-full">
      <CurrentPlanHeader />
      <CurrentPlanContent />
      <CurrentPlanFooter />
    </Card>
  );
}
