"use client";

import * as React from "react";

import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export function ResizableVertical() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Resizable Vertical</CardTitle>
      </CardHeader>
      <CardContent className="flex justify-center items-center">
        <ResizablePanelGroup direction="vertical">
          <ResizablePanel>One</ResizablePanel>
          <ResizableHandle />
          <ResizablePanel>Two</ResizablePanel>
        </ResizablePanelGroup>
      </CardContent>
    </Card>
  );
}
