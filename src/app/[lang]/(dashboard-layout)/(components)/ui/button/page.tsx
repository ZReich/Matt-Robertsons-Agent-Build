import type { Metadata } from "next";

import { ButtonVariants } from "./_components/button-variants";
import { ButtonSizes } from "./_components/button-sizes";
import { ButtonMisc } from "./_components/button-misc";

// Define metadata for the page
// More info: https://nextjs.org/docs/app/building-your-application/optimizing/metadata
export const metadata: Metadata = {
  title: "Button",
};

export default function ButtonPage() {
  return (
    <section className="container grid gap-4 p-4 md:grid-cols-2">
      <ButtonVariants />
      <ButtonSizes />
      <ButtonMisc />
    </section>
  );
}
