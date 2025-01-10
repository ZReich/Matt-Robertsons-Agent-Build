import { VerifyEmailForm } from "./verify-email-form";
import {
  Auth,
  AuthHeader,
  AuthTitle,
  AuthDescription,
  AuthForm,
} from "../auth-layout";

export function VerifyEmail() {
  return (
    <Auth>
      <AuthHeader>
        <AuthTitle>Verify Your Email</AuthTitle>
        <AuthDescription>
          Check your inbox for an email from us and follow the verification link
        </AuthDescription>
      </AuthHeader>
      <AuthForm>
        <VerifyEmailForm />
      </AuthForm>
    </Auth>
  );
}
