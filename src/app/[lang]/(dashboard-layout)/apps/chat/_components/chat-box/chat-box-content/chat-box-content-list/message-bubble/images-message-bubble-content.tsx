import Link from "next/link";
import Image from "next/image";

import { cn } from "@/lib/utils";

import type { MessageType } from "../../../../../types";

export function ImagesMessageBubbleContent({
  images,
}: {
  images: MessageType["images"];
}) {
  if (!images || !images.length) return null; // Return null if the images are empty

  return (
    <ul
      className={cn(
        "grid gap-2 rounded-lg",
        images.length > 1 && "grid-cols-2"
      )}
    >
      {/* Map through the first 3 images from `images` and render them */}
      {images.slice(0, 3).map((image) => (
        <li key={image.id}>
          <Link
            href=""
            className="relative block aspect-square"
            aria-label="Image"
          >
            <Image
              src={image.url}
              alt={image.name}
              className="object-cover rounded-lg"
              fill
            />
          </Link>
        </li>
      ))}

      {/* Check if there are 4 or more images and if there are more than 4 render '+N' over the 4th image */}
      {images && images.length >= 4 && (
        <li>
          <Link href="" className="relative size-full block aspect-square">
            <Image
              src={images[3].url}
              alt={images[3].name}
              className="object-cover rounded-lg"
              fill
            />
            {images.length > 4 && (
              <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-50 text-2xl text-white rounded-lg hover:bg-opacity-75">
                <span>+{images.length - 4}</span>
                <span className="sr-only">More images</span>
              </div>
            )}
          </Link>
        </li>
      )}
    </ul>
  );
}
