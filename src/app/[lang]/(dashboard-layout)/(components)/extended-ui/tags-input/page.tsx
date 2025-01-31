import type { Metadata } from "next";

import { BasicTagsInput } from "./_components/basic-tags-input";
import { TagsInputPlaceholder } from "./_components/tags-input-placeholder";
import { TagsInputWithSuggestionsComponent } from "./_components/tags-input-with-suggestions";

// Define metadata for the page
// More info: https://nextjs.org/docs/app/building-your-application/optimizing/metadata
export const metadata: Metadata = {
  title: "Tags Input",
};

export default function TagsInputPage() {
  return (
    <section className="container grid gap-4 p-4 md:grid-cols-2">
      <BasicTagsInput />
      <TagsInputPlaceholder />
      <TagsInputWithSuggestionsComponent />
    </section>
  );
}
