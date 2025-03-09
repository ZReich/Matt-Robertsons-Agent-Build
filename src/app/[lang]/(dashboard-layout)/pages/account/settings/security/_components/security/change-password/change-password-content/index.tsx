import type { UserType } from "../../../../../../types"

import { CardContent } from "@/components/ui/card"
import { ChangePasswordForm } from "./chnage-password-form"

export function ChangePasswordContent({ user }: { user: UserType }) {
  return (
    <CardContent>
      <ChangePasswordForm user={user} />
    </CardContent>
  )
}
