import type { Metadata } from "next";

import type { LocaleType } from "@/configs/i18n";

import { ForgotPasswordForm } from "./_components/forgot-password-form";
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
  title: "Forgot Password",
};

export default function ForgotPasswordPage({
  params,
}: {
  params: { lang: LocaleType };
}) {
  return (
    <Auth>
      <AuthHeader>
        <AuthTitle>Forgot Password</AuthTitle>
        <AuthDescription>
          Enter your email below to send you instructions to reset your password
        </AuthDescription>
      </AuthHeader>
      <AuthForm>
        <ForgotPasswordForm locale={params.lang} />
      </AuthForm>
    </Auth>
  );
}
