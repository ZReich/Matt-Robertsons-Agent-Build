"use client";

import * as React from "react";

import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export function BasicLabel() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Basic Label</CardTitle>
      </CardHeader>
      <CardContent className="flex justify-center items-center">
        <div>
          <div className="flex items-center gap-x-2">
            <Checkbox id="terms" />
            <Label htmlFor="terms">Accept terms and conditions</Label>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
