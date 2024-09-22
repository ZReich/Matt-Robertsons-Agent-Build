import type { Metadata } from "next";

import type { Locale } from "@/configs/i18n";

import { ForgotPasswordForm } from "./_components/forgot-password-form";
import {
  Auth,
  AuthHeader,
  AuthTitle,
  AuthDescription,
  AuthForm,
} from "../_components/auth-layout";

export const metadata: Metadata = {
  title: "Forgot Password",
  description: "Register instructions to reset your password",
};

export default function ForgotPasswordPage({
  params,
}: {
  params: { lang: Locale };
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
