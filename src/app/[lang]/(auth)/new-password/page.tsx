import type { Metadata } from "next";

import { NewPasswordForm } from "./_components/new-password-form";
import {
  Auth,
  AuthHeader,
  AuthTitle,
  AuthDescription,
  AuthForm,
} from "../_components/auth-layout";

export const metadata: Metadata = {
  title: "New Password",
  description: "Set new password",
};

export default function NewPasswordPage() {
  return (
    <Auth>
      <AuthHeader>
        <AuthTitle>New Password</AuthTitle>
        <AuthDescription>Enter your new password</AuthDescription>
      </AuthHeader>
      <AuthForm>
        <NewPasswordForm />
      </AuthForm>
    </Auth>
  );
}
