import type { Metadata } from "next";

import type { LocaleType } from "@/configs/i18n";

import { SignInForm } from "./_components/sign-in-form";
import {
  Auth,
  AuthHeader,
  AuthTitle,
  AuthDescription,
  AuthForm,
} from "../_components/auth-layout";

export const metadata: Metadata = {
  title: "SignIn",
  description: "SignIn to your account",
};

export default function SignInPage({ params }: { params: { lang: LocaleType } }) {
  return (
    <Auth imgSrc="/images/placeholder.svg">
      <AuthHeader>
        <AuthTitle>Sign In</AuthTitle>
        <AuthDescription>
          Enter your email below to sign in to your account
        </AuthDescription>
      </AuthHeader>
      <AuthForm>
        <SignInForm locale={params.lang} />
      </AuthForm>
    </Auth>
  );
}
