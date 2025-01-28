import type { Metadata } from "next";

import { DefaultAlertDialog } from "./_components/default-alert-dialog";

// Define metadata for the page
// More info: https://nextjs.org/docs/app/building-your-application/optimizing/metadata
export const metadata: Metadata = {
  title: "Alert Dialog",
};

export default function AlertDialogPage() {
  return (
    <section className="container grid gap-4 p-4 md:grid-cols-2">
      <DefaultAlertDialog />
    </section>
  );
}
