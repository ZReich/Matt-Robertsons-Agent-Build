import { Card } from "@/components/ui/card"
import { PaymentMethodContent } from "./payment-method-content"
import { PaymentMethodHeader } from "./payment-method-header"

export function PaymentMethod() {
  return (
    <Card>
      <PaymentMethodHeader />
      <PaymentMethodContent />
    </Card>
  )
}
