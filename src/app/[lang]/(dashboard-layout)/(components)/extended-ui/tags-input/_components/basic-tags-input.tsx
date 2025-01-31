"use client";

import * as React from "react";

import { TagsInput } from "@/components/ui/tags-input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export function BasicTagsInput() {
  const [tags, setTags] = React.useState<string[]>(["React", "TypeScript"]);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Basic Tags Input</CardTitle>
      </CardHeader>
      <CardContent className="flex justify-center items-center">
        <TagsInput tags={tags} onTagsChange={setTags} />
      </CardContent>
    </Card>
  );
}
