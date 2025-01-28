"use client";

import * as React from "react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { InputFile } from "@/components/ui/input-file";
import { FileDropzone } from "@/components/ui/file-dropzone";

export function FileInputs() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>File Inputs</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-1.5">
          <Label>Single File Input</Label>
          <InputFile buttonVariant="default" />
          <InputFile buttonVariant="secondary" />
          <InputFile buttonVariant="ghost" />
          <InputFile buttonVariant="destructive" />
        </div>
        <div className="space-y-1.5">
          <Label>Multiple Files Input</Label>
          <InputFile buttonVariant="default" multiple />
          <InputFile buttonVariant="secondary" multiple />
          <InputFile buttonVariant="ghost" multiple />
          <InputFile buttonVariant="destructive" multiple />
        </div>
        <div className="space-y-1.5">
          <Label>Dropdown Single File Input</Label>
          <FileDropzone />
        </div>
        <div className="space-y-1.5">
          <Label>Dropdown Multiple Files Input</Label>
          <FileDropzone multiple />
        </div>
      </CardContent>
    </Card>
  );
}
