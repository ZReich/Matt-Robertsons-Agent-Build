import { ForgotPasswordForm } from "./forgot-password-form";
import {
  Auth,
  AuthHeader,
  AuthTitle,
  AuthDescription,
  AuthForm,
} from "../auth-layout";

export function ForgotPassword() {
  return (
    <Auth>
      <AuthHeader>
        <AuthTitle>Forgot Password</AuthTitle>
        <AuthDescription>
          Enter your email below to send you instructions to reset your password
        </AuthDescription>
      </AuthHeader>
      <AuthForm>
        <ForgotPasswordForm />
      </AuthForm>
    </Auth>
  );
}
