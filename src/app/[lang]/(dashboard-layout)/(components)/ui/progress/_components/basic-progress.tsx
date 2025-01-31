"use client";

import * as React from "react";

import { Progress } from "@/components/ui/progress";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export function BasicProgress() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Basic Progress</CardTitle>
      </CardHeader>
      <CardContent className="flex justify-center items-center">
        <Progress value={33} />
      </CardContent>
    </Card>
  );
}
