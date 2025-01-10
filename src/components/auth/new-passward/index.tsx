import { NewPasswordForm } from "./new-password-form";
import {
  Auth,
  AuthHeader,
  AuthTitle,
  AuthDescription,
  AuthForm,
} from "../auth-layout";

export function NewPassword() {
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
