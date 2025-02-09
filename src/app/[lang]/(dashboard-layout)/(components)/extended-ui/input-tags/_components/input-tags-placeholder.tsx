"use client";

import * as React from "react";

import { InputTags } from "@/components/ui/input-tags";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export function InputTagsPlaceholder() {
  const [tags, setTags] = React.useState<string[]>([]);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Input Tags Placeholder</CardTitle>
      </CardHeader>
      <CardContent className="flex justify-center items-center">
        <InputTags
          placeholder="Add tags..."
          tags={tags}
          onTagsChange={setTags}
        />
      </CardContent>
    </Card>
  );
}
