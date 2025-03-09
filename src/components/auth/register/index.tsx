import {
  Auth,
  AuthDescription,
  AuthForm,
  AuthHeader,
  AuthTitle,
} from "../auth-layout"
import { RegisterForm } from "./register-form"

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
  )
}
