"use client"

import * as React from "react"
import { zodResolver } from "@hookform/resolvers/zod"
import { useForm } from "react-hook-form"
import { LoaderCircle, Paperclip, Send } from "lucide-react"

import { FilesUploaderSchema } from "../../../_schemas/files-uploader-schema"

import type { FilesUploaderFormType } from "../../../types"

import { formatFileSize } from "@/lib/utils"

import { useChatContext } from "../../../hooks/use-chat-context"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { FileDropzone } from "@/components/ui/file-dropzone"
import {
  Form,
  FormDescription,
  FormField,
  FormItem,
  FormMessage,
} from "@/components/ui/form"
import { MAX_FILES, MAX_FILE_SIZE } from "../../../constants"

const formattedFileSize = formatFileSize(MAX_FILE_SIZE)

export function FilesUploader() {
  const { handleAddFilesMessage } = useChatContext()
  const [isOpen, setIsOpen] = React.useState(false)
  const form = useForm<FilesUploaderFormType>({
    resolver: zodResolver(FilesUploaderSchema),
    defaultValues: {
      files: [],
    },
  })

  const { isSubmitting, isValid } = form.formState
  const isDisabled = isSubmitting || !isValid // Disable button if form is invalid or submitting

  const onSubmit = async (data: FilesUploaderFormType) => {
    handleAddFilesMessage(data.files)

    // Reset to default
    form.reset()
    setIsOpen(false)
  }

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon" className="relative">
          <Paperclip className="h-4 w-4" aria-label="Files" />
        </Button>
      </DialogTrigger>
      <DialogContent className="rounded-lg" aria-describedby={undefined}>
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
                  <FileDropzone
                    onFilesChange={field.onChange}
                    multiple
                    maxSize={MAX_FILE_SIZE}
                    maxFiles={MAX_FILES}
                    {...field}
                  />
                  <FormDescription>
                    Select up to {MAX_FILES} files, with a maximum file size of{" "}
                    {formattedFileSize} per file.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

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
  )
}
