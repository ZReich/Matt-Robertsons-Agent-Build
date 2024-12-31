import type { UserType } from "../../../../../types";

import { Card } from "@/components/ui/card";
import { AccountRecoveryOptionsHeader } from "./account-recovery-options-header";
import { AccountRecoveryOptionsContent } from "./account-recovery-options-content";

export function AccountRecoveryOptions({ user }: { user: UserType }) {
  return (
    <Card>
      <AccountRecoveryOptionsHeader />
      <AccountRecoveryOptionsContent user={user} />
    </Card>
  );
}
