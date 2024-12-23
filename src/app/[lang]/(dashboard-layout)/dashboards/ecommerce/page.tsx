import type { Metadata } from "next";

import { Ecommerce } from "./_components/ecommerce";

// Define metadata for the page
// More info: https://nextjs.org/docs/app/building-your-application/optimizing/metadata
export const metadata: Metadata = {
  title: "Ecommerce",
};

export default function EcommercePage() {
  return <Ecommerce />;
}
