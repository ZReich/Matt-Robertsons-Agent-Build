"use client";

import React from "react";
import { X } from "lucide-react";

import { formatFileSize } from "@/lib/utils";

import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { FileThumbnail } from "@/components/file-thumbnail";

interface FilePreviewListProps {
  files: File[];
  onRemove: (index: number) => void;
}

export function FilePreviewList({ files, onRemove }: FilePreviewListProps) {
  return (
    <div className="mt-2">
      <h4 className="text-sm font-medium mb-2">
        Selected File{files.length > 1 && "s"}:
      </h4>
      <TooltipProvider>
        <ul className="grid grid-cols-5 gap-x-2">
          {files.map((file, index) => (
            <Tooltip key={crypto.randomUUID()} delayDuration={0}>
              <TooltipTrigger className="cursor-default" asChild>
                <li
                  className="relative aspect-square flex flex-col justify-center items-center bg-accent text-accent-foreground break-all rounded-md"
                  aria-label="File"
                >
                  <Button
                    variant="secondary"
                    size="icon"
                    className="absolute top-1 end-1 size-4 z-10"
                    onClick={() => onRemove(index)}
                  >
                    <X
                      className="size-4 hover:text-destructive"
                      aria-label="Remove"
                    />
                  </Button>
                  <FileThumbnail fileName={file.name} />
                  <span className="text-xs">{formatFileSize(file.size)}</span>
                </li>
              </TooltipTrigger>
              <TooltipContent>
                <p>{file.name}</p>
              </TooltipContent>
            </Tooltip>
          ))}
        </ul>
      </TooltipProvider>
    </div>
  );
}
