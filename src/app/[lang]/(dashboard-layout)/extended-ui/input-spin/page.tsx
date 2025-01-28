import type { Metadata } from "next";

import { DefaultInputSpin } from "./_components/default-input-spin";
import { InputSpinButtonVariants } from "./_components/input-spin-button-variants";
import { InputSpinMin } from "./_components/input-spin-min";
import { InputSpinMax } from "./_components/input-spin-max";
import { InputSpinStep } from "./_components/input-spin-step";
import { InputSpinDisabled } from "./_components/input-spin-disabled";

// Define metadata for the page
// More info: https://nextjs.org/docs/app/building-your-application/optimizing/metadata
export const metadata: Metadata = {
  title: "Input Spin",
};

export default function InputSpinPage() {
  return (
    <section className="container grid gap-4 p-4 md:grid-cols-2">
      <div className="grid gap-4">
        <DefaultInputSpin />
        <InputSpinMin />
        <InputSpinMax />
      </div>
      <InputSpinButtonVariants />
      <InputSpinStep />
      <InputSpinDisabled />
    </section>
  );
}
