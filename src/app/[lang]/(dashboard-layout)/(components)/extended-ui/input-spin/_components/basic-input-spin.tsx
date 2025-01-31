"use client";

import * as React from "react";

import { InputSpin } from "@/components/ui/input-spin";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export function BasicInputSpin() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Basic Input Spin</CardTitle>
      </CardHeader>
      <CardContent className="flex justify-center items-center">
        <InputSpin />
      </CardContent>
    </Card>
  );
}
