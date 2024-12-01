import { userData } from "@/data/user";

import type { LocaleType } from "@/configs/i18n";

import { ProfileHeader } from "./_components/profile-header";

export default function AccountPage({
  params,
}: {
  params: { lang: LocaleType };
}) {
  return (
    <div>
      <ProfileHeader locale={params.lang} user={userData} />
    </div>
  );
}
