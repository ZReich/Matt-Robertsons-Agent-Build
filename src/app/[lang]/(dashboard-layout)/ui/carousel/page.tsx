import type { Metadata } from "next";

import { DefaultCarousel } from "./_components/default-carousel";
import { CarouselAutoplay } from "./_components/carousel-autoplay";
import { CarouselSizes } from "./_components/carousel-sizes";
import { CarouselSpacing } from "./_components/carousel-Spacing";
import { CarouselOrientation } from "./_components/carousel-orientation";

// Define metadata for the page
// More info: https://nextjs.org/docs/app/building-your-application/optimizing/metadata
export const metadata: Metadata = {
  title: "Carousel",
};

export default function CarouselPage() {
  return (
    <section className="container grid gap-4 p-4 md:grid-cols-2">
      <DefaultCarousel />
      <CarouselSizes />
      <CarouselSpacing />
      <CarouselOrientation />
      <CarouselAutoplay />
    </section>
  );
}
