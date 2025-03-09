import type { UserType } from "../../../../../types"

import { CardContent } from "@/components/ui/card"
import { DeleteAccountForm } from "./delete-account-form"

export function DangerousZoneContent({ user }: { user: UserType }) {
  return (
    <CardContent>
      <DeleteAccountForm user={user} />
    </CardContent>
  )
}
