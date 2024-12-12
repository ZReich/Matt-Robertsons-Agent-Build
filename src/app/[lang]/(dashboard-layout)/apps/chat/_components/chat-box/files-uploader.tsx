"use client";

import * as React from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useDropzone } from "react-dropzone";
import { X, Upload, LoaderCircle, Paperclip, Send } from "lucide-react";

import { MAX_FILES, MAX_FILE_SIZE, MIN_FILES } from "../../constants";

import { FilesUploaderSchema } from "../../_schemas/files-uploader-schema";

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
import { FileThumbnail } from "@/components/file-thumbnail";

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
  const isDisabled = isSubmitting || !isValid;

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

  // Configure dropzone for drag-and-drop file uploads
  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDropAccepted: handleFilesChange,
    noClick: true,
    maxFiles: MAX_FILES,
    maxSize: MAX_FILE_SIZE,
  });

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
                  <FormLabel
                    className={`block border-2 border-dashed border-muted-foreground/50 bg-muted/50 rounded-lg py-6 px-4 text-center cursor-pointer transition-colors ${
                      isDragActive ? "border-primary bg-primary/10" : ""
                    }`}
                    {...getRootProps()} // Dropzone root props for drag-and-drop functionality
                  >
                    <FormControl>
                      <Input
                        {...getInputProps({
                          ref: field.ref,
                          name: field.name,
                          onChange: (e) => handleFilesChange(e.target.files),
                          onBlur: field.onBlur,
                          disabled: field.disabled,
                        })} // Dropzone root props for drag-and-drop functionality
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
                      Drag and drop some files here, or click to select files
                    </span>
                  </FormLabel>
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
                              onClick={() => handleFileRemove(index)}
                            >
                              <X
                                className="size-4 hover:text-destructive"
                                aria-label="Remove"
                              />
                            </Button>
                            <FileThumbnail fileName={file.name} />
                            <span className="text-xs">
                              {formatFileSize(file.size)}
                            </span>
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
