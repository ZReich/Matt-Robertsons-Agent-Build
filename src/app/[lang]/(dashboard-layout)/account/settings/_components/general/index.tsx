import type { UserType } from "../../../types";

import { ProfileInfo } from "./profile-info";
import { DangerousZone } from "./dangerous-zone";

export function General({ user }: { user: UserType }) {
  return (
    <div className="grid gap-4">
      <ProfileInfo user={user} />
      <DangerousZone user={user} />
    </div>
  );
}
