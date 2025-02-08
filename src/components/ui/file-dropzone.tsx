"use client";

import * as React from "react";
import Image from "next/image";
import { useDropzone } from "react-dropzone";
import { UploadCloud, X } from "lucide-react";

import { cn, formatFileSize } from "@/lib/utils";

import type { DropzoneOptions } from "react-dropzone";
import type { FileType } from "@/types";

import { Button } from "@/components/ui/button";
import { FileThumbnail } from "../file-thumbnail";
import { ScrollArea } from "./scroll-area";

export interface FileDropzoneProps extends Partial<DropzoneOptions> {
  className?: string;
  value?: FileType[];
  onFilesChange?: (files: FileType[]) => void;
}

export function FileDropzone({
  className,
  value,
  onFilesChange,
  ...props
}: FileDropzoneProps) {
  const [files, setFiles] = React.useState<FileType[]>(value || []);

  const maxFiles = props.multiple ? props.maxFiles : 1;
  const isDisabled = maxFiles === files.length;

  const onDrop = React.useCallback(
    (acceptedFiles: File[]) => {
      const newFiles = acceptedFiles.map((file) => ({
        id: crypto.randomUUID(),
        name: file.name,
        size: file.size,
        type: file.type,
        url: URL.createObjectURL(file),
      }));

      const updatedFiles = [...files, ...newFiles];
      setFiles(updatedFiles);
      onFilesChange?.(updatedFiles);
    },
    [files, onFilesChange]
  );

  React.useEffect(() => {
    if (value) {
      setFiles(value);
    }
  }, [value]);

  React.useEffect(() => {
    // Cleanup: Revoke the object URL when component unmounts
    return () => files.forEach((file) => URL.revokeObjectURL(file.url));
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    disabled: isDisabled,
    ...props,
    maxFiles,
  });

  const removeFile = (fileId: string) => {
    const updatedFiles = files.filter((file) => file.id !== fileId);
    setFiles(updatedFiles);
    onFilesChange?.(updatedFiles);
  };

  return (
    <div
      {...getRootProps()}
      className={cn(
        "h-[17.75rem] w-full relative flex rounded-lg border-2 border-dashed border-muted-foreground cursor-pointer transition-colors hover:border-primary hover:bg-muted/50",
        isDragActive && "border-primary bg-muted/50",
        isDisabled && "cursor-not-allowed",
        className
      )}
    >
      <input {...getInputProps()} />
      <ScrollArea className="w-0 flex-1 p-6">
        {files.length > 0 ? (
          <div className="grid gap-4 grid-cols-2">
            {Array.from(files).map((file, index) => (
              <div
                key={file.id}
                className="relative flex flex-col rounded-lg border bg-background p-2 cursor-auto"
              >
                {file.type.startsWith("image/") ? (
                  <Image
                    src={file.url}
                    alt={file.name}
                    width={165}
                    height={165}
                    className="self-center mb-2 aspect-square rounded object-contain pointer-events-none"
                  />
                ) : (
                  <FileThumbnail
                    fileName={file.name}
                    className="self-center size-[10.312rem] text-4xl"
                  />
                )}
                <div className="space-y-1">
                  <p className="text-sm font-medium truncate">{file.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {formatFileSize(file.size)}
                  </p>
                </div>
                <Button
                  variant="secondary"
                  size="icon"
                  className="absolute end-1 top-1 h-4 w-4"
                  onClick={(e) => {
                    e.stopPropagation();
                    removeFile(file.id);
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
      </ScrollArea>
    </div>
  );
}
