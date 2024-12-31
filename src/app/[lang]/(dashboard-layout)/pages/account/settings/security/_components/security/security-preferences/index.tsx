import type { UserType } from "../../../../../types";

import { Card } from "@/components/ui/card";
import { SecurityPreferencesHeader } from "./security-preferences-header";
import { SecurityPreferencesContent } from "./security-preferences-content";

export function SecurityPreferences({ user }: { user: UserType }) {
  return (
    <Card>
      <SecurityPreferencesHeader />
      <SecurityPreferencesContent user={user} />
    </Card>
  );
}
