import { z } from "zod";

import { formatFileSize } from "@/lib/utils";

import { MAX_FILES, MAX_FILE_SIZE, MIN_FILES } from "../constants";

export const fomratedFileSize = formatFileSize(MAX_FILE_SIZE);

export const FilesDialogSchema = z.object({
  files: z
    .array(z.instanceof(File))
    .min(MIN_FILES, {
      message: `You must select at least ${MIN_FILES} file${
        MIN_FILES > 1 ? "s" : ""
      }.`,
    })
    .max(MAX_FILES, {
      message: `You can select a maximum of ${MAX_FILES} files.`,
    })
    .refine(
      (fileArray) => fileArray.every((file) => file.size <= MAX_FILE_SIZE),
      {
        message: `Each file must be ${fomratedFileSize} or less.`,
      }
    ),
});
