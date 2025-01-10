import type { Metadata } from "next";

import { ForgotPassword } from "@/components/auth/forgot-password";

// Define metadata for the page
// More info: https://nextjs.org/docs/app/building-your-application/optimizing/metadata
export const metadata: Metadata = {
  title: "Forgot Password",
};

export default function ForgotPasswordPage() {
  return <ForgotPassword />;
}
