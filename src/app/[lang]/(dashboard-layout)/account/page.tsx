import { userData } from "./_data/user";

import { Locale } from "@/configs/i18n";

import { ProfileHeader } from "./_components/profile-header";
import { About } from "./_components/about";
import { Connections } from "./_components/connections";
import { Teams } from "./_components/teams";

export default function AccountPage({ params }: { params: { lang: Locale } }) {
  const user = userData;

  return (
    <div>
      <ProfileHeader locale={params.lang} user={user} />
      <section className="container w-full gap-4 p-4 md:grid md:grid-cols-3">
        <div className="space-y-4">
          <About />
          <Connections />
          <Teams />
        </div>
      </section>
    </div>
  );
}
