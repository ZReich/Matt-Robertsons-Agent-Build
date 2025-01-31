import type { Metadata } from "next";

import { BasicResizable } from "./_components/basic-resizable";
import { ResizableVertical } from "./_components/resizable-vertical";
import { ResizableHandleComponent } from "./_components/resizable-handle";

// Define metadata for the page
// More info: https://nextjs.org/docs/app/building-your-application/optimizing/metadata
export const metadata: Metadata = {
  title: "Resizable",
};

export default function ResizablePage() {
  return (
    <section className="container grid gap-4 p-4 md:grid-cols-2">
      <BasicResizable />
      <ResizableVertical />
      <ResizableHandleComponent />
    </section>
  );
}
