import type { UserType } from "../../../../types";

import { Card } from "@/components/ui/card";
import { ProfileInfoHeader } from "./profile-info-header";
import { ProfileInfoContent } from "./profile-info-content";

export function ProfileInfo({ user }: { user: UserType }) {
  return (
    <Card>
      <ProfileInfoHeader />
      <ProfileInfoContent user={user} />
    </Card>
  );
}
