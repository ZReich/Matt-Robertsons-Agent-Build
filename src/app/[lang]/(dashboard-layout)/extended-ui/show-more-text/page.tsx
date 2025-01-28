import type { Metadata } from "next";

import { DefaultShowMoreText } from "./_components/default-show-more-text";
import { ShowMoreTextMaxLength } from "./_components/show-more-text-max-length";

// Define metadata for the page
// More info: https://nextjs.org/docs/app/building-your-application/optimizing/metadata
export const metadata: Metadata = {
  title: "Show More Text",
};

export default function ShowMoreTextPage() {
  return (
    <section className="container grid gap-4 p-4 md:grid-cols-2">
      <DefaultShowMoreText />
      <ShowMoreTextMaxLength />
    </section>
  );
}
