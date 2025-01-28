import type { Metadata } from "next";

import { DefaultAspectRatio } from "./_components/default-aspect-ratio";

// Define metadata for the page
// More info: https://nextjs.org/docs/app/building-your-application/optimizing/metadata
export const metadata: Metadata = {
  title: "Aspect Ratio",
};

export default function AspectRatioPage() {
  return (
    <section className="container grid gap-4 p-4 md:grid-cols-2">
      <DefaultAspectRatio />
    </section>
  );
}
