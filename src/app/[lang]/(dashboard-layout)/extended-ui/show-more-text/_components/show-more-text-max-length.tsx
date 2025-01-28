"use client";

import * as React from "react";

import { ShowMoreText } from "@/components/ui/show-more-text";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

const text =
  "Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.";

export function ShowMoreTextMaxLength() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Max Length</CardTitle>
        <CardDescription>Set to max of 100 characters</CardDescription>
      </CardHeader>
      <CardContent className="flex justify-center items-center">
        <ShowMoreText text={text} maxLength={100} />
      </CardContent>
    </Card>
  );
}
