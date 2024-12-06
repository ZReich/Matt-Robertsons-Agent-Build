import type { Metadata } from "next";

import type { LocaleType } from "@/configs/i18n";

import { VerifyEmailForm } from "./_components/verify-email-form";
import {
  Auth,
  AuthHeader,
  AuthTitle,
  AuthDescription,
  AuthForm,
} from "../_components/auth-layout";

export const metadata: Metadata = {
  title: "Verify Email",
};

export default function VerifyEmailPage({ params }: { params: { lang: LocaleType } }) {
  return (
    <Auth>
      <AuthHeader>
        <AuthTitle>Verify Your Email</AuthTitle>
        <AuthDescription>
          Check your inbox for an email from us and follow the verification link
        </AuthDescription>
      </AuthHeader>
      <AuthForm>
        <VerifyEmailForm locale={params.lang} />
      </AuthForm>
    </Auth>
  );
}
