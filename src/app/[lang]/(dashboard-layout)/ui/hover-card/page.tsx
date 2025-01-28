import type { Metadata } from "next";

import { DefaultHoverCard } from "./_components/default-hover-card";

// Define metadata for the page
// More info: https://nextjs.org/docs/app/building-your-application/optimizing/metadata
export const metadata: Metadata = {
  title: "Hover Card",
};

export default function HoverCardPage() {
  return (
    <section className="container grid gap-4 p-4 md:grid-cols-2">
      <DefaultHoverCard />
    </section>
  );
}
