import { userData } from "@/data/user";

import type { Metadata } from "next";

import { Security } from "./_components/security";

// Define metadata for the page
// More info: https://nextjs.org/docs/app/building-your-application/optimizing/metadata
export const metadata: Metadata = {
  title: "Security Settings",
};

export default function SecurityPage() {
  return <Security user={userData} />;
}
