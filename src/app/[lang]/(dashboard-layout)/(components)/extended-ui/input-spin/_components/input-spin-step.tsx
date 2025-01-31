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

export function InputSpinStep() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Input Spin Step</CardTitle>
        <CardDescription>Set to 2 steps</CardDescription>
      </CardHeader>
      <CardContent className="flex justify-center items-center">
        <InputSpin step={2} />
      </CardContent>
    </Card>
  );
}
