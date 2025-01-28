"use client";

import * as React from "react";

import { InputFile } from "@/components/ui/input-file";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export function DefaultInputFile() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Defualt</CardTitle>
      </CardHeader>
      <CardContent className="flex items-center justify-center">
        <InputFile />
      </CardContent>
    </Card>
  );
}
