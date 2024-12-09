import { formatCurrency } from "@/lib/utils";

import type { PaymentType } from "../../types";

import { Card } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";

export function PaymentSummary({ data }: { data: PaymentType["summary"] }) {
  return (
    <div className="w-full lg:w-3/5">
      <Card className="space-y-4 bg-accent p-6">
        <div className="space-y-2">
          <dl className="flex items-center justify-between gap-4">
            <dt className="text-accent-foreground">Original price</dt>
            <dd className="text-base font-medium text-accent-foreground">
              {formatCurrency(data.originalPrice)}
            </dd>
          </dl>
          <dl className="flex items-center justify-between gap-4">
            <dt className="text-accent-foreground">Savings</dt>
            <dd className="text-base font-medium text-success">
              {formatCurrency(data.savings)}
            </dd>
          </dl>
          <dl className="flex items-center justify-between gap-4">
            <dt className="text-accent-foreground">Store Pickup</dt>
            <dd className="text-base font-medium text-accent-foreground">
              {formatCurrency(data.storePickup)}
            </dd>
          </dl>
          <dl className="flex items-center justify-between gap-4">
            <dt className="text-accent-foreground">Tax</dt>
            <dd className="text-base font-medium text-accent-foreground">
              {formatCurrency(data.tax)}
            </dd>
          </dl>
        </div>
        <Separator />
        <dl className="flex items-center justify-between gap-4">
          <dt className="text-base font-bold text-accent-foreground">Total</dt>
          <dd className="text-base font-bold text-accent-foreground">
            {formatCurrency(data.total)}
          </dd>
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
