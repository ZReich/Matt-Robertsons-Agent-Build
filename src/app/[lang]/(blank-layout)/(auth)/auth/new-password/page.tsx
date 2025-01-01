import type { Metadata } from "next";

import { NewPassword } from "./_components/new-passward";

// Define metadata for the page
// More info: https://nextjs.org/docs/app/building-your-application/optimizing/metadata
export const metadata: Metadata = {
  title: "New Password",
};

export default function NewPasswordPage() {
  return <NewPassword />;
}
