"use client";

import * as React from "react";

import { SeparatorWithText } from "@/components/ui/separator";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export function DefaultSeparatorWithText() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Defualt</CardTitle>
      </CardHeader>
      <CardContent className="flex justify-center items-center">
        <SeparatorWithText>Default</SeparatorWithText>
      </CardContent>
    </Card>
  );
}
