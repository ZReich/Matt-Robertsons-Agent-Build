import type { PaymentType } from "../../../types"

import { CardContent } from "@/components/ui/card"
import { PaymentMethodForm } from "./payment-method-form"
import { PaymentSummary } from "./payment-summary"

export function PaymentContent({ data }: { data: PaymentType }) {
  return (
    <CardContent className="flex flex-col-reverse gap-8 lg:flex-row">
      <PaymentMethodForm data={data.savedCards} />
      <PaymentSummary data={data.summary} />
    </CardContent>
  )
}
