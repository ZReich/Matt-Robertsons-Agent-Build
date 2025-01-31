"use client";

import * as React from "react";

import { InputFile } from "@/components/ui/input-file";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export function InputFileButtonLabel() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Input File Button Label</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col justify-center items-center gap-y-1.5">
        <InputFile />
        <InputFile buttonLabel="Upload" />
      </CardContent>
    </Card>
  );
}
