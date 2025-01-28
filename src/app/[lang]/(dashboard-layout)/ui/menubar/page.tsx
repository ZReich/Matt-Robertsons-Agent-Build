import type { Metadata } from "next";

import { DefaultMenubar } from "./_components/default-menubar";

// Define metadata for the page
// More info: https://nextjs.org/docs/app/building-your-application/optimizing/metadata
export const metadata: Metadata = {
  title: "Menubar",
};

export default function MenubarPage() {
  return (
    <section className="container grid gap-4 p-4 md:grid-cols-2">
      <DefaultMenubar />
    </section>
  );
}
