import { RegisterForm } from "./register-form";
import {
  Auth,
  AuthHeader,
  AuthTitle,
  AuthDescription,
  AuthForm,
} from "../../../_components/auth-layout";

export function Register() {
  return (
    <Auth imgSrc="/images/placeholder.svg">
      <AuthHeader>
        <AuthTitle>Sign Up</AuthTitle>
        <AuthDescription>
          Enter your information to create an account
        </AuthDescription>
      </AuthHeader>
      <AuthForm>
        <RegisterForm />
      </AuthForm>
    </Auth>
  );
}
