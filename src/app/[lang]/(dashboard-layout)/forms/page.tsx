import type { Metadata } from "next";

import { Forms } from "./_components/forms";

// Define metadata for the page
// More info: https://nextjs.org/docs/app/building-your-application/optimizing/metadata
export const metadata: Metadata = {
  title: "Forms",
};

export default function FormsPage() {
  return <Forms />;
}
