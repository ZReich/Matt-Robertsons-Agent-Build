import type { Metadata } from "next";

import { pricingData } from "./_data/pricing";

import { Pricing } from "./_components/pricing";

// Define metadata for the page
// More info: https://nextjs.org/docs/app/building-your-application/optimizing/metadata
export const metadata: Metadata = {
  title: "Pricing",
};

export default function PricingPage() {
  return <Pricing data={pricingData} />;
}
