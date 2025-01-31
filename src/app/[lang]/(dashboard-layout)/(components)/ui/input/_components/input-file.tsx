"use client";

import * as React from "react";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export function InputFile() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Input File</CardTitle>
      </CardHeader>
      <CardContent className="flex justify-center items-center">
        <div className="grid w-full max-w-sm items-center gap-1.5">
          <Label htmlFor="picture">Picture</Label>
          <Input id="picture" type="file" />
        </div>
      </CardContent>
    </Card>
  );
}
