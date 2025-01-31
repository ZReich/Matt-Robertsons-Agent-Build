"use client";

import * as React from "react";

import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export function BasicInput() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Basic Input</CardTitle>
      </CardHeader>
      <CardContent className="flex justify-center items-center">
        <Input type="email" placeholder="Email" />
      </CardContent>
    </Card>
  );
}
