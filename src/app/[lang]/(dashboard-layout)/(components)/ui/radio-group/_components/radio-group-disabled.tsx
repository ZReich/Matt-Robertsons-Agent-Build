"use client";

import * as React from "react";

import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export function RadioGroupDisabled() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Radio Group Disabled</CardTitle>
      </CardHeader>
      <CardContent className="grid gap-2">
        <RadioGroup defaultValue="option-one-disabled" disabled>
          <div className="flex items-center space-x-2">
            <RadioGroupItem
              value="option-one-disabled"
              id="option-one-disabled"
            />
            <Label htmlFor="option-one-disabled">Option One</Label>
          </div>
          <div className="flex items-center space-x-2">
            <RadioGroupItem
              value="option-two-disabled"
              id="option-two-disabled"
              disabled
            />
            <Label htmlFor="option-two-disabled">Option Two</Label>
          </div>
        </RadioGroup>
      </CardContent>
    </Card>
  );
}
