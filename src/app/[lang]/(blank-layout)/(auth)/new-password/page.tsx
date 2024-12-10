import type { Metadata } from "next";

import type { LocaleType } from "@/configs/i18n";

import { NewPasswordForm } from "./_components/new-password-form";
import {
  Auth,
  AuthHeader,
  AuthTitle,
  AuthDescription,
  AuthForm,
} from "../_components/auth-layout";

// Define metadata for the page
// More info: https://nextjs.org/docs/app/building-your-application/optimizing/metadata
export const metadata: Metadata = {
  title: "New Password",
};

export default function NewPasswordPage({ params }: { params: { lang: LocaleType } }) {
  return (
    <Auth>
      <AuthHeader>
        <AuthTitle>New Password</AuthTitle>
        <AuthDescription>Enter your new password</AuthDescription>
      </AuthHeader>
      <AuthForm>
        <NewPasswordForm locale={params.lang} />
      </AuthForm>
    </Auth>
  );
}
