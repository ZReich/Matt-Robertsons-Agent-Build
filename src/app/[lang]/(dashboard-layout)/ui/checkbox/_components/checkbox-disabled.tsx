import * as React from "react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";

export function CheckboxDisabled() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Disabled</CardTitle>
      </CardHeader>
      <CardContent className="flex justify-center items-center">
        <div className="flex items-center space-x-2">
          <Checkbox id="terms2" disabled />
          <label
            htmlFor="terms2"
            className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
          >
            Accept terms and conditions
          </label>
        </div>
      </CardContent>
    </Card>
  );
}
