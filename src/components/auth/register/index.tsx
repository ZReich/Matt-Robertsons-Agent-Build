import { RegisterForm } from "./register-form";
import {
  Auth,
  AuthHeader,
  AuthTitle,
  AuthDescription,
  AuthForm,
} from "../auth-layout";

export function Register() {
  return (
    <Auth imgSrc="https://images.unsplash.com/photo-1635315619556-5826839a1bea">
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
