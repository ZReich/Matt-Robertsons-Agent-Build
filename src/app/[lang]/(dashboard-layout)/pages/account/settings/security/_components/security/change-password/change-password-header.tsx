import { CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export function ChangePasswordHeader() {
  return (
    <CardHeader>
      <CardTitle>Change Password</CardTitle>
      <CardDescription>
        Update your password to keep your account secure. Choose a strong,
        unique password.
      </CardDescription>
    </CardHeader>
  );
}
