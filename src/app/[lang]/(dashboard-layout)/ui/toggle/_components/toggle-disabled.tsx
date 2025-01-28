"use client";

import * as React from "react";
import { Underline } from "lucide-react";

import { Toggle } from "@/components/ui/toggle";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export function ToggleDisabled() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Disabled</CardTitle>
      </CardHeader>
      <CardContent className="flex justify-center items-center">
        <Toggle aria-label="Toggle italic" disabled>
          <Underline className="h-4 w-4" />
        </Toggle>
      </CardContent>
    </Card>
  );
}
