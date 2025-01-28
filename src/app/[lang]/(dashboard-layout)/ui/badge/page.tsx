import type { Metadata } from "next";

import { DefaultBadge } from "./_components/default-badge";
import { SecondaryBadge } from "./_components/secondary-badge";
import { OutlineBadge } from "./_components/outline-badge";
import { DestructiveBadge } from "./_components/destructive-badge";

// Define metadata for the page
// More info: https://nextjs.org/docs/app/building-your-application/optimizing/metadata
export const metadata: Metadata = {
  title: "Badge",
};

export default function BadgePage() {
  return (
    <section className="container grid gap-4 p-4 md:grid-cols-2">
      <DefaultBadge />
      <SecondaryBadge />
      <OutlineBadge />
      <DestructiveBadge />
    </section>
  );
}
