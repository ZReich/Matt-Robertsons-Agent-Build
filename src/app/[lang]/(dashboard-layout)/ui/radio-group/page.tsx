import type { Metadata } from "next";

import { DefaultRadioGroup } from "./_components/default-radio-group";

// Define metadata for the page
// More info: https://nextjs.org/docs/app/building-your-application/optimizing/metadata
export const metadata: Metadata = {
  title: "RadioGroup",
};

export default function RadioGroupPage() {
  return (
    <section className="container grid gap-4 p-4 md:grid-cols-2">
      <DefaultRadioGroup />
    </section>
  );
}
