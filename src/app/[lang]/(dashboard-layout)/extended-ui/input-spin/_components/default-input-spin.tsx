"use client";

import * as React from "react";

import { InputSpin } from "@/components/ui/input-spin";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export function DefaultInputSpin() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Defualt</CardTitle>
      </CardHeader>
      <CardContent className="flex justify-center items-center">
        <InputSpin />
      </CardContent>
    </Card>
  );
}
