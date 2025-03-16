import type { UserType } from "../../../types"

import { CardContent } from "@/components/ui/card"
import { AccountRecoveryOptionsForm } from "./account-recovery-options-form"

export function AccountRecoveryOptionsContent({ user }: { user: UserType }) {
  return (
    <CardContent>
      <AccountRecoveryOptionsForm user={user} />
    </CardContent>
  )
}
