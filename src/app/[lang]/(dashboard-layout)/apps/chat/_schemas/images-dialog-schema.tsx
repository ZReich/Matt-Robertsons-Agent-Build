import { z } from "zod";

import { formatFileSize } from "@/lib/utils";

import { MAX_IMAGE_SIZE, MAX_IMAGES, MIN_IMAGES } from "../constants";

const formattedImageSize = formatFileSize(MAX_IMAGE_SIZE);

export const ImagesDialogSchema = z.object({
  images: z
    .array(z.instanceof(File))
    .min(MIN_IMAGES, {
      message: `You must select at least ${MIN_IMAGES} image${
        MIN_IMAGES > 1 ? "s" : ""
      }.`,
    })
    .max(MAX_IMAGES, {
      message: `You can select a maximum of ${MAX_IMAGES} images.`,
    })
    .refine(
      (imageArray) => imageArray.every((image) => image.size <= MAX_IMAGE_SIZE),
      {
        message: `Each image must be ${formattedImageSize} or less.`,
      }
    ),
});
