import type { UserType } from "../../../../../types";

import { Card } from "@/components/ui/card";
import { ChangePasswordHeader } from "./change-password-header";
import { ChangePasswordContent } from "./change-password-content";

export function ChangePassword({ user }: { user: UserType }) {
  return (
    <Card>
      <ChangePasswordHeader />
      <ChangePasswordContent user={user} />
    </Card>
  );
}
