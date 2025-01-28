import type { Metadata } from "next";

import { DefaultRatings } from "./_components/default-ratings";
import { RatingsLength } from "./_components/ratings-length";
import { RatingsSizes } from "./_components/ratings-sizes";
import { RatingsVariants } from "./_components/ratings-variants";

// Define metadata for the page
// More info: https://nextjs.org/docs/app/building-your-application/optimizing/metadata
export const metadata: Metadata = {
  title: "Ratings",
};

export default function RatingsPage() {
  return (
    <section className="container grid gap-4 p-4 md:grid-cols-2">
      <DefaultRatings />
      <RatingsLength />
      <RatingsSizes />
      <RatingsVariants />
    </section>
  );
}
