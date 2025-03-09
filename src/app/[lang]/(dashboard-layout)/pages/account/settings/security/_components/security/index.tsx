import type { UserType } from "../../../../types"

import { AccountRecoveryOptions } from "./account-recovery-options"
import { ChangePassword } from "./change-password"
import { RecentLogs } from "./recent-logs"
import { SecurityPreferences } from "./security-preferences"

export function Security({ user }: { user: UserType }) {
  return (
    <div className="grid gap-4">
      <ChangePassword user={user} />
      <SecurityPreferences user={user} />
      <AccountRecoveryOptions user={user} />
      <RecentLogs />
    </div>
  )
}
