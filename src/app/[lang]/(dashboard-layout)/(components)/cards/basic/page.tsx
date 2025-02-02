import type { Metadata } from "next";

import { CardWithTabs } from "./_components/card-with-tabs";
import { CardWithImage } from "./_components/card-with-image";
import { CardWithFilledImage } from "./_components/card-with-filled-image";
import { CardOverlay } from "./_components/card-overlay";
import { CardWithImageHorizontal } from "./_components/card-with-image-horizontal";
import { CardWithFilledImageHorizontal } from "./_components/card-with-filled-image-horizontal copy";

// Define metadata for the page
// More info: https://nextjs.org/docs/app/building-your-application/optimizing/metadata
export const metadata: Metadata = {
  title: "Basic Cards",
};

export default function BasicCardsPage() {
  return (
    <section className="container grid gap-4 p-4 md:grid-cols-2">
      <CardWithImage />
      <CardWithFilledImage />
      <CardOverlay />
      <div className="space-y-4">
        <CardWithImageHorizontal />
        <CardWithFilledImageHorizontal />
      </div>
      <CardWithTabs />
    </section>
  );
}
