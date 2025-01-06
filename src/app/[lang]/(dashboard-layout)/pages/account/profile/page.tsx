import { userData } from "@/data/user";

import type { Metadata } from "next";
import type { LocaleType } from "@/types";

import { ProfileHeader } from "./_components/profile-header";

// Define metadata for the page
// More info: https://nextjs.org/docs/app/building-your-application/optimizing/metadata
export const metadata: Metadata = {
  title: "Profile",
};

export default function ProfilePage({
  params,
}: {
  params: { lang: LocaleType };
}) {
  return (
    <div className="container px-0">
      <ProfileHeader locale={params.lang} user={userData} />
    </div>
  );
}
