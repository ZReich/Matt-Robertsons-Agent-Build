"use client";

import * as React from "react";

import { InputPhone } from "@/components/ui/input-phone";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export function BasicInputPhone() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Basic Input Phone</CardTitle>
      </CardHeader>
      <CardContent className="flex justify-center items-center">
        <InputPhone />
      </CardContent>
    </Card>
  );
}
