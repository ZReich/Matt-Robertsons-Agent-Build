"use client";

import * as React from "react";

import { InputSpin } from "@/components/ui/input-spin";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export function InputSpinMin() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Min</CardTitle>
        <CardDescription>Set to minimum of 5</CardDescription>
      </CardHeader>
      <CardContent className="flex justify-center items-center">
        <InputSpin value={5} min={5} />
      </CardContent>
    </Card>
  );
}
