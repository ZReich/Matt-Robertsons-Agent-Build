import type { UserType } from "../../../../../types"

import { Card } from "@/components/ui/card"
import { ChangePasswordContent } from "./change-password-content"
import { ChangePasswordHeader } from "./change-password-header"

export function ChangePassword({ user }: { user: UserType }) {
  return (
    <Card>
      <ChangePasswordHeader />
      <ChangePasswordContent user={user} />
    </Card>
  )
}
