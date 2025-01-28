"use client";

import * as React from "react";

import { Slider } from "@/components/ui/slider";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export function DefaultSlider() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Defualt</CardTitle>
      </CardHeader>
      <CardContent className="flex justify-center items-center">
        <Slider defaultValue={[33]} max={100} step={1} />
      </CardContent>
    </Card>
  );
}
