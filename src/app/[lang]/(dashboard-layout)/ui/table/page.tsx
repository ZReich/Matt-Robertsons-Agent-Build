import type { Metadata } from "next";

import { DefaultTable } from "./_components/default-table";

// Define metadata for the page
// More info: https://nextjs.org/docs/app/building-your-application/optimizing/metadata
export const metadata: Metadata = {
  title: "Table",
};

export default function TablePage() {
  return (
    <section className="container grid gap-4 p-4 md:grid-cols-2">
      <DefaultTable />
    </section>
  );
}
