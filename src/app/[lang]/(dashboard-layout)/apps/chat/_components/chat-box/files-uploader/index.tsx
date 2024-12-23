"use client";

import * as React from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useDropzone } from "react-dropzone";
import { X, Upload, LoaderCircle, Paperclip, Send } from "lucide-react";

import { MAX_FILES, MAX_FILE_SIZE, MIN_FILES } from "../../../constants";

import { FilesUploaderSchema } from "../../../_schemas/files-uploader-schema";

import { formatFileSize } from "@/lib/utils";

import { useChatContext } from "../../../hooks/use-chat-context";

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
import { FileThumbnail } from "@/components/file-thumbnail";
import { FilePreviewList } from "./file-preview-list";
import { FileDropzone } from "./file-dropzone";

const fomratedFileSize = formatFileSize(MAX_FILE_SIZE);

type FormType = z.infer<typeof FilesUploaderSchema>;

export function FilesUploader() {
  const { handleAddFilesMessage } = useChatContext();
  const [isOpen, setIsOpen] = React.useState(false);
  const [fileUrls, setFileUrls] = React.useState<string[]>([]);
  const form = useForm<FormType>({
    resolver: zodResolver(FilesUploaderSchema),
    defaultValues: {
      files: [],
    },
  });

  const files = form.watch("files");
  const { isSubmitting, isValid } = form.formState;
  const isDisabled = isSubmitting || !isValid; // Disable button if form is invalid or submitting

  const onSubmit = async (data: FormType) => {
    handleAddFilesMessage(data.files);

    // Revoke temporary URLs after submission
    fileUrls.forEach((url) => URL.revokeObjectURL(url));

    // Reset to default
    setFileUrls([]);
    form.reset();
    setIsOpen(false);
  };

  const handleFilesChange = React.useCallback(
    (acceptedFiles: FileList | File[] | null) => {
      if (!acceptedFiles) return;

      // Convert accepted files to an array and merge with current files while respecting the max limit
      const newFilesArray = [...files, ...Array.from(acceptedFiles)].slice(
        0,
        MAX_FILES
      );

      form.setValue("files", newFilesArray);

      // Create object URLs for new files
      const newFileUrls = Array.from(acceptedFiles).map((file) =>
        URL.createObjectURL(file)
      );
      setFileUrls((prevUrls) => [...prevUrls, ...newFileUrls]);

      form.trigger("files"); // Trigger form validation
    },
    [form, files]
  );

  const handleFileRemove = (index: number) => {
    // Revoke the object URL for the removed file
    const urlToRevoke = fileUrls[index];
    URL.revokeObjectURL(urlToRevoke);

    // Remove file at specified index
    const updatedFiles = files.filter((_, i) => i !== index);
    const updatedUrls = fileUrls.filter((_, i) => i !== index);

    form.setValue("files", updatedFiles);
    setFileUrls(updatedUrls);
    form.trigger("files"); // Trigger form validation
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon" className="relative">
          <Paperclip className="h-4 w-4" aria-label="Files" />
        </Button>
      </DialogTrigger>
      <DialogContent className="rounded-lg">
        <DialogHeader>
          <DialogTitle>Send Files</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="w-full grid">
            <FormField
              control={form.control}
              name="files"
              render={({ field }) => (
                <FormItem className="space-y-0">
                  <FileDropzone field={field} onChange={handleFilesChange} />
                  <FormDescription>
                    Select between {MIN_FILES} and {MAX_FILES} files, with a
                    maximum file size of {fomratedFileSize} per file.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Display selected files if they are available */}
            {files && files.length > 0 && (
              <FilePreviewList files={files} onRemove={handleFileRemove} />
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
