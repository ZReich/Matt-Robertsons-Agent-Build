import type { UserType } from "../../../../types";

import { Card } from "@/components/ui/card";
import { DangerousZoneHeader } from "./dangerous-zone-header";
import { DangerousZoneContent } from "./dangerous-zone-content";

export function DangerousZone({ user }: { user: UserType }) {
  return (
    <Card>
      <DangerousZoneHeader />
      <DangerousZoneContent user={user} />
    </Card>
  );
}
