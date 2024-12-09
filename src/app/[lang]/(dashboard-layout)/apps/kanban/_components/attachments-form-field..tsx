"use client";

import * as React from "react";
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

type FormValues = z.infer<typeof KanbanTaskSchema>;

export function AttachmentsFormField({
  form,
}: {
  form: UseFormReturn<FormValues>;
}) {
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const attachments = form.watch("attachments");

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);

    // Generate object URLs for each file
    const newAttachments = files.map((file) => ({
      name: file.name,
      size: file.size,
      type: file.type,
      url: URL.createObjectURL(file),
    }));

    // Update form values accordingly
    form.setValue("attachments", [...attachments, ...newAttachments]);
  };

  const handleFileRemove = (index: number) => {
    // Revoke the object URL
    URL.revokeObjectURL(attachments[index].url);

    // Update form values accordingly
    form.setValue(
      "attachments",
      attachments
        .filter((_, i) => i !== index)
        .map((attachment) => ({
          name: attachment.name,
          size: attachment.size,
          type: attachment.type,
          url: attachment.url,
        }))
    );
  };

  const handleButtonClick = () => {
    // Open file input dialog
    fileInputRef.current?.click();
  };

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
              />
            </>
          </FormControl>
          <FormDescription>
            {attachments.length} file(s) selected
          </FormDescription>
          <div className="flex flex-wrap gap-2 mt-2">
            {attachments.map((attachment, index) => (
              <div key={attachment.url} className="size-fit relative">
                {attachment.type.includes("image") ? (
                  <img
                    src={attachment.url}
                    alt={attachment.name}
                    className="size-20 mt-2 object-cover rounded-md"
                  />
                ) : (
                  <div className="size-20 flex flex-col justify-center items-center p-2">
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
                  aria-label="Remove"
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
