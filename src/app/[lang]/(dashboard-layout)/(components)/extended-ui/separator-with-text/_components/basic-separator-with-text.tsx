"use client";

import * as React from "react";

import { SeparatorWithText } from "@/components/ui/separator";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export function BasicSeparatorWithText() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Basic Separator with Text</CardTitle>
      </CardHeader>
      <CardContent className="flex justify-center items-center">
        <SeparatorWithText>Basic</SeparatorWithText>
      </CardContent>
    </Card>
  );
}
