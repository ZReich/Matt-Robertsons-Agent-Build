import { userData } from "@/data/user";

import type { Metadata } from "next";
import type { LocaleType } from "@/types";

import { General } from "./_components/general";

// Define metadata for the page
// More info: https://nextjs.org/docs/app/building-your-application/optimizing/metadata
export const metadata: Metadata = {
  title: "Profile Information Settings",
};

export default function ProfileInfoPage() {
  return <General user={userData} />;
}
