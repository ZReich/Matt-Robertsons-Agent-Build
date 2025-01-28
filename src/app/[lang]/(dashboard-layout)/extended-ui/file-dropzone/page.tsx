import type { Metadata } from "next";

import { DefaultFileDropzone } from "./_components/default-file-dropzone";
import { FileDropzoneMultiple } from "./_components/file-dropzone-multiple";
import { FileDropzoneMaxFiles } from "./_components/file-dropzone-max-files";
import { FileDropzoneMaxSize } from "./_components/file-dropzone-max-size";

// Define metadata for the page
// More info: https://nextjs.org/docs/app/building-your-application/optimizing/metadata
export const metadata: Metadata = {
  title: "File Dropzone",
};

export default function FileDropzonePage() {
  return (
    <section className="container grid gap-4 p-4 md:grid-cols-2">
      <DefaultFileDropzone />
      <FileDropzoneMultiple />
      <FileDropzoneMaxFiles />
      <FileDropzoneMaxSize />
    </section>
  );
}
