"use client";

import * as React from "react";

import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export function ResizableHandleComponent() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Resizable Handle</CardTitle>
      </CardHeader>
      <CardContent className="flex justify-center items-center">
        <ResizablePanelGroup direction="horizontal">
          <ResizablePanel>One</ResizablePanel>
          <ResizableHandle withHandle />
          <ResizablePanel>Two</ResizablePanel>
        </ResizablePanelGroup>
      </CardContent>
    </Card>
  );
}
