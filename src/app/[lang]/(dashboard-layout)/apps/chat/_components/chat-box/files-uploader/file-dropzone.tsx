"use client";

import * as React from "react";
import { useDropzone } from "react-dropzone";
import { Upload } from "lucide-react";

import { MAX_FILE_SIZE, MAX_FILES } from "../../../constants";

import type { ControllerRenderProps } from "react-hook-form";

import { FormLabel, FormControl } from "@/components/ui/form";
import { Input } from "@/components/ui/input";

interface FileDropzoneProps {
  field: ControllerRenderProps<{ files: File[] }, "files">;
  onChange: (files: File[] | FileList | null) => void;
}

export function FileDropzone({ field, onChange }: FileDropzoneProps) {
  // Configure dropzone for drag-and-drop file uploads
  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDropAccepted: onChange,
    noClick: true,
    maxFiles: MAX_FILES,
    maxSize: MAX_FILE_SIZE,
  });

  return (
    <FormLabel
      className={`block border-2 border-dashed border-muted-foreground/50 bg-muted/50 rounded-lg py-6 px-4 text-center cursor-pointer transition-colors ${
        isDragActive ? "border-primary bg-primary/10" : ""
      }`}
      {...getRootProps()}
    >
      <FormControl>
        <Input
          {...getInputProps({
            ref: field.ref,
            name: field.name,
            onChange: (e) => onChange(e.target.files),
            onBlur: field.onBlur,
            disabled: field.disabled,
          })}
        />
      </FormControl>
      <Upload
        className="mx-auto h-12 w-12 text-muted-foreground"
        aria-labelledby="dnd-description"
      />
      <span className="mt-2 text-sm text-foreground" id="dnd-description">
        Drag and drop some files here, or click to select files
      </span>
    </FormLabel>
  );
}
