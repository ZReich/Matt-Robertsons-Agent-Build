import { paymentData } from "./_data/payment";

import type { Metadata } from "next";

import { Payment } from "./_components/payment";

// Define metadata for the page
// More info: https://nextjs.org/docs/app/building-your-application/optimizing/metadata
export const metadata: Metadata = {
  title: "Payment",
};

export default async function PaymentPage() {
  return <Payment data={paymentData} />;
}
