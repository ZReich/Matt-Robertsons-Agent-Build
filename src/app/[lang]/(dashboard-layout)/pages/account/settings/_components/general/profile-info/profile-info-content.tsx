import type { UserType } from "../../../../types";

import { CardContent } from "@/components/ui/card";
import { ProfileInfoForm } from "./profile-info-form";

export function ProfileInfoContent({ user }: { user: UserType }) {
  return (
    <CardContent>
      <ProfileInfoForm user={user} />
    </CardContent>
  );
}
