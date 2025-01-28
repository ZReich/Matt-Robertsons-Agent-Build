import type { Metadata } from "next";

import { DefaultResizable } from "./_components/default-resizable";
import { DefaultResizableVertical } from "./_components/resizable-vertical";
import { DefaultResizableHandle } from "./_components/resizable-handle";

// Define metadata for the page
// More info: https://nextjs.org/docs/app/building-your-application/optimizing/metadata
export const metadata: Metadata = {
  title: "Resizable",
};

export default function ResizablePage() {
  return (
    <section className="container grid gap-4 p-4 md:grid-cols-2">
      <DefaultResizable />
      <DefaultResizableVertical />
      <DefaultResizableHandle />
    </section>
  );
}
