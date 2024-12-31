import type { PaymentType } from "../../types";

import { CardHeader, CardTitle } from "@/components/ui/card";

export function PaymentHeader() {
  return (
    <CardHeader>
      <CardTitle>Payment</CardTitle>
    </CardHeader>
  );
}
