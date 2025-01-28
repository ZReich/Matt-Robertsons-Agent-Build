import type { Metadata } from "next";

import { DefaultTabs } from "./_components/default-tabs";

// Define metadata for the page
// More info: https://nextjs.org/docs/app/building-your-application/optimizing/metadata
export const metadata: Metadata = {
  title: "Tabs",
};

export default function TabsPage() {
  return (
    <section className="container grid gap-4 p-4 md:grid-cols-2">
      <DefaultTabs />
    </section>
  );
}
