import type { UserType } from "../../../types"

import { DangerousZone } from "./dangerous-zone"
import { ProfileInfo } from "./profile-info"

export function General({ user }: { user: UserType }) {
  return (
    <div className="grid gap-4">
      <ProfileInfo user={user} />
      <DangerousZone user={user} />
    </div>
  )
}
