import { Card } from "@/components/ui/card";

interface PaymentSummaryProps {
  originalPrice: string;
  savings: string;
  storePickup: string;
  tax: string;
  total: string;
}

export function PaymentSummary({
  originalPrice,
  savings,
  storePickup,
  tax,
  total,
}: PaymentSummaryProps) {
  return (
    <div className="w-full lg:w-3/5">
      <Card className="space-y-4 bg-secondary p-6">
        <div className="space-y-2">
          <dl className="flex items-center justify-between gap-4">
            <dt className="text-muted-foreground">Original price</dt>
            <dd className="text-base font-medium text-foreground">
              ${originalPrice}
            </dd>
          </dl>

          <dl className="flex items-center justify-between gap-4">
            <dt className="text-muted-foreground">Savings</dt>
            <dd className="text-base font-medium text-green-500">
              -${savings}
            </dd>
          </dl>

          <dl className="flex items-center justify-between gap-4">
            <dt className="text-muted-foreground">Store Pickup</dt>
            <dd className="text-base font-medium text-foreground">
              ${storePickup}
            </dd>
          </dl>

          <dl className="flex items-center justify-between gap-4">
            <dt className="text-muted-foreground">Tax</dt>
            <dd className="text-base font-medium text-foreground">${tax}</dd>
          </dl>
        </div>

        <dl className="flex items-center justify-between gap-4 border-t border-muted-foreground pt-2">
          <dt className="text-base font-bold text-foreground">Total</dt>
          <dd className="text-base font-bold text-foreground">${total}</dd>
        </dl>
      </Card>

      <div className="mt-6 flex items-center justify-center gap-8">
        <img
          src="/images/logos/paypal.svg"
          alt="Paypal logo"
          className="h-6 md:h-8"
        />
        <img
          src="/images/logos/visa.svg"
          alt="Visa logo"
          className="h-6 md:h-8"
        />
        <img
          src="/images/logos/mastercard.svg"
          alt="Mastercard logo"
          className="h-6 md:h-8"
        />
      </div>
    </div>
  );
}
