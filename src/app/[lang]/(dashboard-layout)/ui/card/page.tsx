import type { Metadata } from "next";

import { DefaultCard } from "./_components/default-card";

// Define metadata for the page
// More info: https://nextjs.org/docs/app/building-your-application/optimizing/metadata
export const metadata: Metadata = {
  title: "Card",
};

export default function CardPage() {
  return (
    <section className="container grid gap-4 p-4 md:grid-cols-2">
      <DefaultCard />
    </section>
  );
}
