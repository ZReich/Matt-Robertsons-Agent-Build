"use client";

import * as React from "react";

import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export function BasicTextarea() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Basic Textarea</CardTitle>
      </CardHeader>
      <CardContent className="flex justify-center items-center">
        <Textarea placeholder="Type your message here." />
      </CardContent>
    </Card>
  );
}
