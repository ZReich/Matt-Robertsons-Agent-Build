"use client";

import { useState, useCallback } from "react";
import Image from "next/image";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useDropzone } from "react-dropzone";
import { X, Upload, LoaderCircle, Send, ImageIcon } from "lucide-react";

import { formatFileSize } from "@/lib/utils";

import { useChatContext } from "../../hooks/use-chat-context";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

const MIN_IMAGES = 1;
const MAX_IMAGES = 5;
const MAX_IMAGE_SIZE = 500000000; // 500 MB
const formattedImageSize = formatFileSize(MAX_IMAGE_SIZE);

const FormSchema = z.object({
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

type FormType = z.infer<typeof FormSchema>;

export function ImagesDialog() {
  const { handleAddImagesMessage } = useChatContext();
  const [isOpen, setIsOpen] = useState(false);
  const [imageUrls, setImageUrls] = useState<string[]>([]);
  const form = useForm<FormType>({
    resolver: zodResolver(FormSchema),
    defaultValues: {
      images: [],
    },
  });

  const images = form.watch("images");
  const { isSubmitting, isValid } = form.formState;
  const isDisabled = isSubmitting || !isValid;

  const onSubmit = async (data: FormType) => {
    handleAddImagesMessage(data.images);

    // Revoke temporary URLs after submission
    imageUrls.forEach((url) => URL.revokeObjectURL(url));

    setImageUrls([]);
    form.reset();
    setIsOpen(false);
  };

  const handleImageChange = useCallback(
    (acceptedImages: FileList | File[] | null) => {
      if (!acceptedImages) return;

      const newImagesArray = [...images, ...Array.from(acceptedImages)].slice(
        0,
        MAX_IMAGES
      );

      form.setValue("images", newImagesArray);

      // Create object URLs for the new images
      const newImageUrls = Array.from(acceptedImages).map((file) =>
        URL.createObjectURL(file)
      );
      setImageUrls((prevUrls) => [...prevUrls, ...newImageUrls]);

      form.trigger("images");
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
    form.trigger("images");
  };

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDropAccepted: handleImageChange,
    accept: { "image/*": [] },
    noClick: true,
    maxFiles: MAX_IMAGES,
    maxSize: MAX_IMAGE_SIZE,
  });

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon" className="relative">
          <ImageIcon className="h-4 w-4" aria-label="Images" />
        </Button>
      </DialogTrigger>
      <DialogContent className="rounded-lg">
        <DialogHeader>
          <DialogTitle>Send Images</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="w-full grid">
            <FormField
              control={form.control}
              name="images"
              render={({ field }) => (
                <FormItem className="space-y-0">
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
                          onChange: (e) => handleImageChange(e.target.files),
                          onBlur: field.onBlur,
                          disabled: field.disabled,
                        })}
                      />
                    </FormControl>
                    <Upload
                      className="mx-auto h-12 w-12 text-muted-foreground"
                      aria-labelledby="dnd-description"
                    />
                    <span
                      className="mt-2 text-sm text-foreground"
                      id="dnd-description"
                    >
                      Drag and drop some images here, or click to select images
                    </span>
                  </FormLabel>
                  <FormDescription>
                    Select between {MIN_IMAGES} and {MAX_IMAGES} images, with a
                    maximum file size of {formattedImageSize} per image.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            {images && images.length > 0 && (
              <div className="mt-2">
                <h4 className="text-sm font-medium mb-2">
                  Selected Image{images.length > 1 && "s"}:
                </h4>
                <TooltipProvider>
                  <ul className="grid grid-cols-5 gap-x-2">
                    {images.map((image, index) => (
                      <Tooltip key={crypto.randomUUID()} delayDuration={0}>
                        <TooltipTrigger className="cursor-default">
                          <li
                            className="relative aspect-square bg-accent text-accent-foreground rounded-md"
                            aria-label="Image"
                          >
                            <Button
                              variant="secondary"
                              size="icon"
                              className="absolute top-1 end-1 size-4 z-10"
                              onClick={() => handleImageRemove(index)}
                            >
                              <X
                                className="size-4 hover:text-destructive"
                                aria-label="Remove"
                              />
                            </Button>
                            <Image
                              src={imageUrls[index]} // Use the stored URL
                              alt={image.name}
                              className="object-cover rounded-md"
                              fill
                            />
                          </li>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>{image.name}</p>
                        </TooltipContent>
                      </Tooltip>
                    ))}
                  </ul>
                </TooltipProvider>
              </div>
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
