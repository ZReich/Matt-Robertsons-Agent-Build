import type { UserType } from "../../../../types"

import { Card } from "@/components/ui/card"
import { DangerousZoneContent } from "./dangerous-zone-content"
import { DangerousZoneHeader } from "./dangerous-zone-header"

export function DangerousZone({ user }: { user: UserType }) {
  return (
    <Card>
      <DangerousZoneHeader />
      <DangerousZoneContent user={user} />
    </Card>
  )
}
