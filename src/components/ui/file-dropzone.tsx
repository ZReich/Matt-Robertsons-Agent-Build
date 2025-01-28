"use client";

import * as React from "react";
import Image from "next/image";
import { useDropzone } from "react-dropzone";
import { UploadCloud, X } from "lucide-react";

import { cn, formatFileSize } from "@/lib/utils";

import type { DropzoneOptions } from "react-dropzone";

import { Button } from "@/components/ui/button";
import { FileThumbnail } from "../file-thumbnail";

export interface FileDropzoneProps extends Partial<DropzoneOptions> {
  className?: string;
  value?: FileList;
  onFilesChanged?: (files: FileList) => void;
}

export function FileDropzone({
  className,
  value,
  onFilesChanged,
  ...props
}: FileDropzoneProps) {
  const [files, setFiles] = React.useState<FileList>(
    value || new DataTransfer().files
  );
  const [previews, setPreviews] = React.useState<string[]>([]);

  const maxFiles = props.multiple ? props.maxFiles : 1;
  const isDisabled = maxFiles === files.length;

  const onDrop = React.useCallback(
    (acceptedFiles: File[]) => {
      const dt = new DataTransfer();
      Array.from(files).forEach((file) => dt.items.add(file));
      acceptedFiles.forEach((file) => dt.items.add(file));

      const updatedFiles = dt.files;
      const newPreviews = acceptedFiles.map((file) =>
        URL.createObjectURL(file)
      );

      setFiles(updatedFiles);
      setPreviews((prev) => [...prev, ...newPreviews]);
      onFilesChanged?.(updatedFiles);
    },
    [files, onFilesChanged]
  );

  React.useEffect(() => {
    if (value) {
      setFiles(value);
      setPreviews(Array.from(value).map((file) => URL.createObjectURL(file)));
    }
  }, [value]);

  const removeFile = (index: number) => {
    const dt = new DataTransfer();
    Array.from(files)
      .filter((_, i) => i !== index)
      .forEach((file) => dt.items.add(file));

    const updatedFiles = dt.files;

    setFiles(updatedFiles);
    setPreviews((prev) => prev.filter((_, i) => i !== index));
    onFilesChanged?.(updatedFiles);
  };

  React.useEffect(() => {
    // Cleanup previews on unmount
    return () => previews.forEach((preview) => URL.revokeObjectURL(preview));
  }, [previews]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    disabled: isDisabled,
    ...props,
    maxFiles,
  });

  return (
    <div
      {...getRootProps()}
      className={cn(
        "min-h-[17.75rem] w-full relative rounded-lg border-2 border-dashed border-muted-foreground p-6 cursor-pointer transition-colors hover:border-primary hover:bg-muted/50",
        isDragActive && "border-primary bg-muted/50",
        isDisabled && "cursor-not-allowed",
        className
      )}
    >
      <input {...getInputProps()} />
      {files.length > 0 ? (
        <div className="grid gap-4 grid-cols-2">
          {Array.from(files).map((file, index) => (
            <div
              key={file.name}
              className="relative rounded-lg border bg-background p-2 cursor-auto"
            >
              {file.type.startsWith("image/") ? (
                <Image
                  src={previews[index]}
                  alt={file.name}
                  width={165}
                  height={165}
                  className="mb-2 aspect-square rounded object-contain pointer-events-none"
                />
              ) : (
                <FileThumbnail
                  fileName={file.name}
                  className="size-[10.312rem] text-4xl"
                />
              )}
              <div className="space-y-1">
                <p className="text-sm font-medium truncate">{file.name}</p>
                <p className="text-xs text-muted-foreground">
                  {formatFileSize(file.size)}
                </p>
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="absolute right-1 top-1"
                onClick={(e) => {
                  e.stopPropagation();
                  removeFile(index);
                }}
                aria-label="Remove"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          ))}
        </div>
      ) : (
        <div className="h-56 flex flex-col justify-center items-center gap-2 text-center p-4">
          <UploadCloud className="h-8 w-8 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">
            Drag and drop some files here, or click to select files
          </p>
        </div>
      )}
    </div>
  );
}
