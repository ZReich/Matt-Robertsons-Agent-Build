import { userData } from "./_data/user";

import { Locale } from "@/configs/i18n";

import { ProfileHeader } from "./_components/profile-header";

export default function AccountPage({ params }: { params: { lang: Locale } }) {
  return (
    <div>
      <ProfileHeader locale={params.lang} user={userData} />
    </div>
  );
}
