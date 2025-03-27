import {
  Auth,
  AuthDescription,
  AuthForm,
  AuthHeader,
  AuthTitle,
} from "./auth-layout"
import { RegisterForm } from "./register-form"

export function Register() {
  return (
    <Auth imgSrc="/images/illustrations/misc/welcome.svg">
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
