"use client";

import * as React from "react";

import { TagsInput } from "@/components/ui/tags-input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export function TagsInputPlaceholder() {
  const [tags, setTags] = React.useState<string[]>([]);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Tags Input Placeholder</CardTitle>
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
