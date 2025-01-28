"use client";

import * as React from "react";
import { Bold } from "lucide-react";

import { Toggle } from "@/components/ui/toggle";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export function DefaultToggle() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Defualt</CardTitle>
      </CardHeader>
      <CardContent className="flex justify-center items-center">
        <Toggle aria-label="Toggle italic">
          <Bold className="h-4 w-4" />
        </Toggle>
      </CardContent>
    </Card>
  );
}
