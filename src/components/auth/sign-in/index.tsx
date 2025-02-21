import { SignInForm } from "./sign-in-form";
import {
  Auth,
  AuthHeader,
  AuthTitle,
  AuthDescription,
  AuthForm,
} from "../auth-layout";

export function SignIn() {
  return (
    <Auth imgSrc="https://images.unsplash.com/photo-1635315619556-5826839a1bea">
      <AuthHeader>
        <AuthTitle>Sign In</AuthTitle>
        <AuthDescription>
          Enter your email below to sign in to your account
        </AuthDescription>
      </AuthHeader>
      <AuthForm>
        <SignInForm />
      </AuthForm>
    </Auth>
  );
}
