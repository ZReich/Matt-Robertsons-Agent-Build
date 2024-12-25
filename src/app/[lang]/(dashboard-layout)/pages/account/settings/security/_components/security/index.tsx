import type { UserType } from "../../../../types";

import { ChangePassword } from "./change-password";
import { SecurityPreferences } from "./security-preferences";
import { AccountRecoveryOptions } from "./account-recovery-options";
import { RecentLogs } from "./recent-logs";

export function Security({ user }: { user: UserType }) {
  return (
    <div className="grid gap-4">
      <ChangePassword user={user} />
      <SecurityPreferences user={user} />
      <AccountRecoveryOptions user={user} />
      <RecentLogs />
    </div>
  );
}
