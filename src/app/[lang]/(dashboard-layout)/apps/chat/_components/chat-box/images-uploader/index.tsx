"use client";

import React from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { Image, LoaderCircle, Send } from "lucide-react";

import { MAX_IMAGE_SIZE, MAX_IMAGES, MIN_IMAGES } from "../../../constants";

import { ImagesUploaderSchema } from "../../../_schemas/images-uploader-schema";

import { useChatContext } from "../../../hooks/use-chat-context";

import { formatFileSize } from "@/lib/utils";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Form,
  FormField,
  FormItem,
  FormDescription,
  FormMessage,
} from "@/components/ui/form";

import { ImageDropzone } from "./image-dropzone";
import { ImagePreviewList } from "./image-preview-list";

const formattedImageSize = formatFileSize(MAX_IMAGE_SIZE);

type FormType = z.infer<typeof ImagesUploaderSchema>;

export function ImagesUploader() {
  const { handleAddImagesMessage } = useChatContext();
  const [isOpen, setIsOpen] = React.useState(false);
  const [imageUrls, setImageUrls] = React.useState<string[]>([]);

  const form = useForm<FormType>({
    resolver: zodResolver(ImagesUploaderSchema),
    defaultValues: { images: [] },
  });

  const images = form.watch("images");
  const { isSubmitting, isValid } = form.formState;
  const isDisabled = isSubmitting || !isValid; // Disable button if form is invalid or submitting

  const onSubmit = async (data: FormType) => {
    handleAddImagesMessage(data.images);

    // Revoke temporary URLs after submission
    imageUrls.forEach((url) => URL.revokeObjectURL(url));

    // Reset to default
    setImageUrls([]);
    form.reset();
    setIsOpen(false);
  };

  const handleImageChange = React.useCallback(
    (acceptedImages: FileList | File[] | null) => {
      if (!acceptedImages) return;

      // Convert accepted images to an array and merge with current images while respecting the max limit
      const newImagesArray = [...images, ...Array.from(acceptedImages)].slice(
        0,
        MAX_IMAGES
      );

      form.setValue("images", newImagesArray);

      // Create object URLs for new image
      const newImageUrls = Array.from(acceptedImages).map((file) =>
        URL.createObjectURL(file)
      );
      setImageUrls((prevUrls) => [...prevUrls, ...newImageUrls]);

      form.trigger("images"); // Trigger form validation
    },
    [form, images]
  );

  const handleImageRemove = (index: number) => {
    // Revoke the object URL for the removed image
    const urlToRevoke = imageUrls[index];
    URL.revokeObjectURL(urlToRevoke);

    // Remove image at specified index
    const updatedImages = images.filter((_, i) => i !== index);
    const updatedUrls = imageUrls.filter((_, i) => i !== index);

    form.setValue("images", updatedImages);
    setImageUrls(updatedUrls);
    form.trigger("images"); // Trigger form validation
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon">
          <Image className="h-4 w-4" aria-label="Images" />
        </Button>
      </DialogTrigger>
      <DialogContent className="rounded-lg">
        <DialogHeader>
          <DialogTitle>Send Images</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="grid">
            <FormField
              control={form.control}
              name="images"
              render={({ field }) => (
                <FormItem>
                  <ImageDropzone field={field} onChange={handleImageChange} />
                  <FormDescription>
                    Select between {MIN_IMAGES} and {MAX_IMAGES} images, with a
                    maximum file size of {formattedImageSize} per image.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Display selected images if they are available */}
            {images && images.length > 0 && (
              <ImagePreviewList
                images={images}
                imageUrls={imageUrls}
                onRemove={handleImageRemove}
              />
            )}

            <Button
              type="submit"
              size="icon"
              className="ms-auto mt-2"
              disabled={isDisabled}
              aria-live="assertive"
              aria-label={isSubmitting ? "Loading" : "Send"}
            >
              {isSubmitting ? (
                <LoaderCircle className="size-4 animate-spin" />
              ) : (
                <Send className="size-4" />
              )}
            </Button>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
