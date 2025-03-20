import type { Metadata } from "next"

import { paymentData } from "./_data/payment"

import { PaymentContent } from "./_components/payment-contnet"
import { PaymentHeader } from "./_components/payment-header"

// Define metadata for the page
// More info: https://nextjs.org/docs/app/building-your-application/optimizing/metadata
export const metadata: Metadata = {
  title: "Payment",
}

export default async function PaymentPage() {
  return (
    <section className="container p-4">
      <PaymentHeader />
      <PaymentContent data={paymentData} />
    </section>
  )
}
