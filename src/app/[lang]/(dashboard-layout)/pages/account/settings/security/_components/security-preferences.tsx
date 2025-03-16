import type { UserType } from "../../../types"

import { Card } from "@/components/ui/card"
import { SecurityPreferencesContent } from "./security-preferences-content"
import { SecurityPreferencesHeader } from "./security-preferences-header"

export function SecurityPreferences({ user }: { user: UserType }) {
  return (
    <Card>
      <SecurityPreferencesHeader />
      <SecurityPreferencesContent user={user} />
    </Card>
  )
}
