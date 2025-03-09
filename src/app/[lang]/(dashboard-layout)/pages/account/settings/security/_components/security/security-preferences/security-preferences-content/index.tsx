import type { UserType } from "../../../../../../types"

import { CardContent } from "@/components/ui/card"
import { SecurityPreferencesForm } from "./security-preferences-form"

export function SecurityPreferencesContent({ user }: { user: UserType }) {
  return (
    <CardContent>
      <SecurityPreferencesForm user={user} />
    </CardContent>
  )
}
