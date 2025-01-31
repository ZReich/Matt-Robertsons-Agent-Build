import type { Metadata } from "next";

import { BasicSelect } from "../../ui/select/_components/basic-select";
import { SelectScrollable } from "../../ui/select/_components/select-scrollable";
import { BasicTagsInput } from "../../extended-ui/tags-input/_components/basic-tags-input";
import { TagsInputPlaceholder } from "../../extended-ui/tags-input/_components/tags-input-placeholder";
import { TagsInputWithSuggestionsComponent } from "../../extended-ui/tags-input/_components/tags-input-with-suggestions";

// Define metadata for the page
// More info: https://nextjs.org/docs/app/building-your-application/optimizing/metadata
export const metadata: Metadata = {
  title: "Select and Tags",
};

export default function SelectAndTagsPage() {
  return (
    <section className="container grid gap-4 p-4 md:grid-cols-2">
      <BasicSelect />
      <SelectScrollable />
      <BasicTagsInput />
      <TagsInputPlaceholder />
      <TagsInputWithSuggestionsComponent />
    </section>
  );
}
