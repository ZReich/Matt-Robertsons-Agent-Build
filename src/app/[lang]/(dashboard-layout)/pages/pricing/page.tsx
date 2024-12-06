import type { Metadata } from "next";

import Pricing from "./_components/pricing";

export const metadata: Metadata = {
  title: "Pricing",
};

export default function PricingPage() {
  return <Pricing />;
}
