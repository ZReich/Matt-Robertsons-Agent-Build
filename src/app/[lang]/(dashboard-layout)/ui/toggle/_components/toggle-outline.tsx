"use client";

import * as React from "react";
import { Italic } from "lucide-react";

import { Toggle } from "@/components/ui/toggle";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export function ToggleOutline() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Outline</CardTitle>
      </CardHeader>
      <CardContent className="flex justify-center items-center">
        <Toggle variant="outline" aria-label="Toggle italic">
          <Italic />
        </Toggle>
      </CardContent>
    </Card>
  );
}
