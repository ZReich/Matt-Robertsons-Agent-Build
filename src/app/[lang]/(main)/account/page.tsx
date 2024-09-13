import { ProfileHeader } from "./_components/profile-header";
import { About } from "./_components/about";
import { Connections } from "./_components/connections";
import Teams from "./_components/teams";
import { Locale } from "@/configs/i18n";

export default function AccountPage({ params }: { params: { lang: Locale } }) {
  return (
    <div>
      <ProfileHeader locale={params.lang} />
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
