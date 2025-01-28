"use client";

import * as React from "react";

import { TagsInput } from "@/components/ui/tags-input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export function DefaultTagsInputPlaceholder() {
  const [tags, setTags] = React.useState<string[]>(["React", "TypeScript"]);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Placeholder</CardTitle>
      </CardHeader>
      <CardContent className="flex justify-center items-center">
        <TagsInput
          placeholder="Add tags..."
          tags={tags}
          onTagsChange={setTags}
        />
      </CardContent>
    </Card>
  );
}
