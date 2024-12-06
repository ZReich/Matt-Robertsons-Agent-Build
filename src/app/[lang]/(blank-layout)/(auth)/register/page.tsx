import type { Metadata } from "next";

import type { LocaleType } from "@/configs/i18n";

import { RegisterForm } from "./_components/register-form";
import {
  Auth,
  AuthHeader,
  AuthTitle,
  AuthDescription,
  AuthForm,
} from "../_components/auth-layout";

export const metadata: Metadata = {
  title: "Register",
};

export default function RegisterPage({ params }: { params: { lang: LocaleType } }) {
  return (
    <Auth imgSrc="/images/placeholder.svg">
      <AuthHeader>
        <AuthTitle>Sign Up</AuthTitle>
        <AuthDescription>
          Enter your information to create an account
        </AuthDescription>
      </AuthHeader>
      <AuthForm>
        <RegisterForm locale={params.lang} />
      </AuthForm>
    </Auth>
  );
}
