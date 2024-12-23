"use client";

import * as React from "react";
import Image from "next/image";
import { UseFormReturn } from "react-hook-form";
import { z } from "zod";
import { X, Paperclip } from "lucide-react";

import { KanbanTaskSchema } from "../_schemas/kanban-task-schema";

import { Button } from "@/components/ui/button";
import {
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";

type FormType = z.infer<typeof KanbanTaskSchema>;

export function AttachmentsFormField({
  form,
}: {
  form: UseFormReturn<FormType>;
}) {
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const attachments = form.watch("attachments");

  // Utility to generate attachment objects
  const createAttachmentObject = (file: File) => ({
    name: file.name,
    size: file.size,
    type: file.type,
    url: URL.createObjectURL(file),
  });

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);

    // Map files to attachment objects
    const newAttachments = files.map(createAttachmentObject);

    // Update form values
    form.setValue("attachments", [...attachments, ...newAttachments]);
  };

  const handleFileRemove = (index: number) => {
    // Revoke URL to free memory
    URL.revokeObjectURL(attachments[index].url);

    // Update form state
    const updatedAttachments = attachments.filter((_, i) => i !== index);
    form.setValue("attachments", updatedAttachments);
  };

  const handleButtonClick = () => {
    fileInputRef.current?.click();
  };

  // Clean up URLs on unmount
  React.useEffect(() => {
    return () => {
      attachments.forEach((attachment) => URL.revokeObjectURL(attachment.url));
    };
  }, [attachments]);

  return (
    <FormField
      control={form.control}
      name="attachments"
      render={() => (
        <FormItem>
          <FormLabel>Attachments</FormLabel>
          <FormControl>
            <>
              <Button
                type="button"
                variant="outline"
                className="w-full"
                onClick={handleButtonClick}
              >
                <Paperclip className="me-2 size-4 text-muted-foreground" />
                Select Attachments
              </Button>
              <Input
                ref={fileInputRef}
                type="file"
                className="sr-only"
                multiple
                onChange={handleFileChange}
                aria-label="Upload files"
              />
            </>
          </FormControl>
          <FormDescription>
            {attachments.length} file(s) selected
          </FormDescription>
          <div className="flex flex-wrap gap-2 mt-2">
            {attachments.map((attachment, index) => (
              <div
                key={attachment.url}
                className="size-fit relative"
                aria-label={`Attachment: ${attachment.name}`}
              >
                {attachment.type.includes("image") ? (
                  <Image
                    src={attachment.url}
                    alt={attachment.name}
                    className="mt-2 object-cover rounded-md"
                    width={80}
                    height={80}
                  />
                ) : (
                  <div
                    className="size-20 flex flex-col justify-center items-center p-2"
                    role="document"
                  >
                    <span className="w-full text-xs truncate">
                      {attachment.name}
                    </span>
                  </div>
                )}
                <Button
                  variant="secondary"
                  size="icon"
                  className="absolute top-3 end-1 size-4"
                  onClick={() => handleFileRemove(index)}
                  aria-label={`Remove attachment: ${attachment.name}`}
                >
                  <X className="size-3" />
                </Button>
              </div>
            ))}
          </div>
          <FormMessage />
        </FormItem>
      )}
    />
  );
}
