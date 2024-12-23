"use client";

import React from "react";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { X } from "lucide-react";

interface ImagePreviewListProps {
  images: File[];
  imageUrls: string[];
  onRemove: (index: number) => void;
};

export function ImagePreviewList({
  images,
  imageUrls,
  onRemove,
}: ImagePreviewListProps) {
  return (
    <div className="mt-2">
      <h4 className="text-sm font-medium mb-2">
        Selected Image{images.length > 1 && "s"}:
      </h4>
      <ul className="grid grid-cols-5 gap-x-2">
        {images.map((image, index) => (
          <li
            key={crypto.randomUUID()}
            className="relative aspect-square bg-accent text-accent-foreground rounded-md"
          >
            <Button
              variant="secondary"
              size="icon"
              className="absolute top-1 end-1 size-4 z-10"
              onClick={() => onRemove(index)}
            >
              <X className="size-4 hover:text-destructive" />
            </Button>
            <Image
              src={imageUrls[index]}
              alt={image.name}
              className="object-cover rounded-md"
              fill
            />
          </li>
        ))}
      </ul>
    </div>
  );
}
