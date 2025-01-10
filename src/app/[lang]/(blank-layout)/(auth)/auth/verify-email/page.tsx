import type { Metadata } from "next";

import { VerifyEmail } from "@/components/auth/verify-email";

// Define metadata for the page
// More info: https://nextjs.org/docs/app/building-your-application/optimizing/metadata
export const metadata: Metadata = {
  title: "Verify Email",
};

export default function VerifyEmailPage() {
  return <VerifyEmail />;
}
