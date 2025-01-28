import type { Metadata } from "next";

import { DefaultInputPhone } from "./_components/default-input-phone";

// Define metadata for the page
// More info: https://nextjs.org/docs/app/building-your-application/optimizing/metadata
export const metadata: Metadata = {
  title: "Input Phone",
};

export default function InputPhonePage() {
  return (
    <section className="container grid gap-4 p-4 md:grid-cols-2">
      <DefaultInputPhone />
    </section>
  );
}
