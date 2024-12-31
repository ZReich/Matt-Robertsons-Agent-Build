import type { PaymentType } from "../../types";

import { Card } from "@/components/ui/card";
import { PaymentContent } from "./payment-contnet";
import { PaymentHeader } from "./payment-header";

export function Payment({ data }: { data: PaymentType }) {
  return (
    <section className="container p-4">
      <Card>
        <PaymentHeader />
        <PaymentContent data={data} />
      </Card>
    </section>
  );
}
