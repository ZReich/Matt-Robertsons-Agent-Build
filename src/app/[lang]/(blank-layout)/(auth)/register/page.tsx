import type { Metadata } from "next";

import { Locale } from "@/configs/i18n";

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
  description: "Register to your account",
};

export default function RegisterPage({ params }: { params: { lang: Locale } }) {
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
