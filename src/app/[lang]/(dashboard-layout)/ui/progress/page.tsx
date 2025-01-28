import type { Metadata } from "next";

import { DefaultProgress } from "./_components/default-progress";

// Define metadata for the page
// More info: https://nextjs.org/docs/app/building-your-application/optimizing/metadata
export const metadata: Metadata = {
  title: "Progress",
};

export default function ProgressPage() {
  return (
    <section className="container grid gap-4 p-4 md:grid-cols-2">
      <DefaultProgress />
    </section>
  );
}
