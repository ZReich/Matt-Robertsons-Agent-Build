import type { UserType } from "../../../../types"

import { Card } from "@/components/ui/card"
import { ProfileInfoContent } from "./profile-info-content"
import { ProfileInfoHeader } from "./profile-info-header"

export function ProfileInfo({ user }: { user: UserType }) {
  return (
    <Card>
      <ProfileInfoHeader />
      <ProfileInfoContent user={user} />
    </Card>
  )
}
