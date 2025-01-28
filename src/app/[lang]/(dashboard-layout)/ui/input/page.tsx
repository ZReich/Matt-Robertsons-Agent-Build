import type { Metadata } from "next";

import { DefaultInput } from "./_components/default-input";
import { InputFile } from "./_components/input-file";
import { InputDisabled } from "./_components/input-disabled";
import { InputWithLabel } from "./_components/input-with-label";
import { InputWithButton } from "./_components/input-with-button";

// Define metadata for the page
// More info: https://nextjs.org/docs/app/building-your-application/optimizing/metadata
export const metadata: Metadata = {
  title: "Input",
};

export default function InputPage() {
  return (
    <section className="container grid gap-4 p-4 md:grid-cols-2">
      <DefaultInput />
      <InputFile />
      <InputDisabled />
      <InputWithLabel />
      <InputWithButton />
    </section>
  );
}
