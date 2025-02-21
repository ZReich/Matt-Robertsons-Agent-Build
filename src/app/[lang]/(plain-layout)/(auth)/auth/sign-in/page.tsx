import type { Metadata } from "next";

import { SignIn } from "@/components/auth/sign-in";

// Define metadata for the page
// More info: https://nextjs.org/docs/app/building-your-application/optimizing/metadata
export const metadata: Metadata = {
  title: "Sign In",
};

export default function SignInPage() {
  return <SignIn />;
}
