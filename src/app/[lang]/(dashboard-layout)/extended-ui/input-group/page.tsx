import type { Metadata } from "next";

import { DefaultInputGroup } from "./_components/default-input-group";
import { InputGroupMerged } from "./_components/input-group-merged";
import { InputGroupCheckboxAndRadio } from "./_components/input-group-checkbox-and-radio";
import { InputGroupDropdownAndButton } from "./_components/input-group-dropdown-button";

// Define metadata for the page
// More info: https://nextjs.org/docs/app/building-your-application/optimizing/metadata
export const metadata: Metadata = {
  title: "Input Group",
};

export default function InputGroupPage() {
  return (
    <section className="container grid gap-4 p-4 md:grid-cols-2">
      <DefaultInputGroup />
      <InputGroupMerged />
      <InputGroupCheckboxAndRadio />
      <InputGroupDropdownAndButton />
    </section>
  );
}
