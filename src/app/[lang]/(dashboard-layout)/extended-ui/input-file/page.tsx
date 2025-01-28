import type { Metadata } from "next";

import { DefaultInputFile } from "./_components/default-input-file";
import { InputFileButtonVariants } from "./_components/input-file-button-varaints";
import { InputFileButtonLabel } from "./_components/input-file-button-label";
import { InputFilePlaceholder } from "./_components/input-file-placeholder";

// Define metadata for the page
// More info: https://nextjs.org/docs/app/building-your-application/optimizing/metadata
export const metadata: Metadata = {
  title: "Input File",
};

export default function InputFilePage() {
  return (
    <section className="container grid gap-4 p-4 md:grid-cols-2">
      <div className="grid gap-4">
        <DefaultInputFile />
        <InputFileButtonLabel />
        <InputFilePlaceholder />
      </div>
      <InputFileButtonVariants />
    </section>
  );
}
