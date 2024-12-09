import type { PaymentType } from "../../types";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PaymentMethodForm } from "./payment-method-form";
import { PaymentSummary } from "./payment-summary";

export function Payment({ data }: { data: PaymentType }) {
  return (
    <section className="container p-4">
      <Card>
        <CardHeader>
          <CardTitle>Payment</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-8 lg:flex-row">
          <PaymentMethodForm data={data.savedCards} />
          <PaymentSummary data={data.summary} />
        </CardContent>
      </Card>
    </section>
  );
}
