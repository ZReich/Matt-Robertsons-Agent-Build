import type { Metadata } from "next";

import { DefaultToast } from "./_components/default-toast";
import { ToastWithTitle } from "./_components/toast-with-title";
import { ToastWithAction } from "./_components/toast-with-action";
import { ToastDestructive } from "./_components/toast-destructive";

// Define metadata for the page
// More info: https://nextjs.org/docs/app/building-your-application/optimizing/metadata
export const metadata: Metadata = {
  title: "Toast",
};

export default function ToastPage() {
  return (
    <section className="container grid gap-4 p-4 md:grid-cols-2">
      <DefaultToast />
      <ToastWithTitle />
      <ToastWithAction />
      <ToastDestructive />
    </section>
  );
}
