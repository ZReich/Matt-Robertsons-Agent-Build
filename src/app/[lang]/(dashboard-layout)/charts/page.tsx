import type { Metadata } from "next";

import { Charts } from "./_components/charts";

// Define metadata for the page
// More info: https://nextjs.org/docs/app/building-your-application/optimizing/metadata
export const metadata: Metadata = {
  title: "Charts",
};

export default function ChartsPage() {
  return <Charts />;
}
