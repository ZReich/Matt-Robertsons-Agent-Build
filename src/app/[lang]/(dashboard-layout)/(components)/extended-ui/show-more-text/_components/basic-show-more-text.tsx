"use client";

import * as React from "react";

import { ShowMoreText } from "@/components/ui/show-more-text";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const text =
  "Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.";

export function BasicShowMoreText() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Basic Show More Text</CardTitle>
      </CardHeader>
      <CardContent className="flex justify-center items-center">
        <ShowMoreText text={text} />
      </CardContent>
    </Card>
  );
}
