import { currentPlanData } from "../../../../../_data/curremt-plan"

import { formatCurrency, formatDate } from "@/lib/utils"

import { CardFooter } from "@/components/ui/card"

export function CurrentPlanFooter() {
  return (
    <CardFooter className="flex justify-between items-center">
      <div>
        <p className="text-sm text-muted-foreground">
          Next billing date:{" "}
          {formatDate(currentPlanData.billingInfo.nextBillingDate)}
        </p>
        <p className="text-sm text-muted-foreground">
          Amount due: {formatCurrency(currentPlanData.billingInfo.amountDue)}
        </p>
      </div>
    </CardFooter>
  )
}
