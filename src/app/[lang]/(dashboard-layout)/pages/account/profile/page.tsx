import type { LocaleType } from "@/types"
import type { Metadata } from "next"

import { ProfileContent } from "./_components/profile-content"
import { ProfileHeader } from "./_components/profile-header"

// Define metadata for the page
// More info: https://nextjs.org/docs/app/building-your-application/optimizing/metadata
export const metadata: Metadata = {
  title: "Profile",
}

export default function ProfilePage({
  params,
}: {
  params: { lang: LocaleType }
}) {
  return (
    <div className="container px-0">
      <ProfileHeader locale={params.lang} />
      <ProfileContent />
    </div>
  )
}
