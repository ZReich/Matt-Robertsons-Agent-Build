import type { Metadata } from "next";

import { DefaultAlert } from "./_components/default-alert";
import { DestructiveAlert } from "./_components/destructive-alert";

// Define metadata for the page
// More info: https://nextjs.org/docs/app/building-your-application/optimizing/metadata
export const metadata: Metadata = {
  title: "Alert",
};

export default function AlertPage() {
  return (
    <section className="container grid gap-4 p-4 md:grid-cols-2">
      <DefaultAlert />
      <DestructiveAlert />
    </section>
  );
}
