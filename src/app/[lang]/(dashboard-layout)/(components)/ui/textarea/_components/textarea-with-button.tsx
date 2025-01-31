"use client";

import * as React from "react";

import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export function TextareaWithButton() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Textarea with Button</CardTitle>
      </CardHeader>
      <CardContent className="flex justify-center items-center">
        <div className="grid w-full gap-2">
          <Textarea placeholder="Type your message here." />
          <Button>Send message</Button>
        </div>
      </CardContent>
    </Card>
  );
}
