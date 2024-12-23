"use client";

import { useDropzone, DropzoneOptions } from "react-dropzone";
import { Upload } from "lucide-react";

import { MAX_IMAGE_SIZE, MAX_IMAGES } from "../../../constants";

import type { ControllerRenderProps } from "react-hook-form";

import { FormLabel, FormControl } from "@/components/ui/form";
import { Input } from "@/components/ui/input";

interface ImageDropzoneProps {
  field: ControllerRenderProps<{ images: File[] }, "images">;
  onChange: (images: File[] | FileList | null) => void;
}

export function ImageDropzone({ field, onChange }: ImageDropzoneProps) {
  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDropAccepted: onChange,
    accept: { "image/*": [] },
    noClick: true,
    maxFiles: MAX_IMAGES,
    maxSize: MAX_IMAGE_SIZE,
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
      <p className="mt-2 text-sm text-foreground" id="dnd-description">
        Drag and drop some images here, or click to select images
      </p>
    </FormLabel>
  );
}
