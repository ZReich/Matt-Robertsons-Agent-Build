"use client";

import * as React from "react";

import { suggestionsData } from "../_data/suggestions";

import { InputTagsWithSuggestions } from "@/components/ui/input-tags";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export function InputTagsWithSuggestionsComponent() {
  const [tags, setTags] = React.useState<string[]>(["React", "TypeScript"]);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Tags Input with Suggestions</CardTitle>
      </CardHeader>
      <CardContent className="flex justify-center items-center">
        <InputTagsWithSuggestions
          suggestions={suggestionsData}
          tags={tags}
          onTagsChange={setTags}
        />
      </CardContent>
    </Card>
  );
}
