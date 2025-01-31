"use client";

import * as React from "react";
import { Italic } from "lucide-react";

import { Toggle } from "@/components/ui/toggle";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export function ToggleWithText() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Toggle with Text</CardTitle>
      </CardHeader>
      <CardContent className="flex justify-center items-center">
        <Toggle aria-label="Toggle italic">
          <Italic />
          Italic
        </Toggle>
      </CardContent>
    </Card>
  );
}
