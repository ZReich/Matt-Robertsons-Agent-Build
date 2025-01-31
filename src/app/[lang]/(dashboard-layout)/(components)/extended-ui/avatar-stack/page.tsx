import type { Metadata } from "next";

import { DefaultAvatarStack } from "./_components/default-avatar-stack";
import { AvatarStackLimit } from "./_components/avatar-stack-limit";
import { AvatarStackSize } from "./_components/avatar-stack-size";

// Define metadata for the page
// More info: https://nextjs.org/docs/app/building-your-application/optimizing/metadata
export const metadata: Metadata = {
  title: "Avatar Stack",
};

export default function AvatarStackPage() {
  return (
    <section className="container grid gap-4 p-4 md:grid-cols-2">
      <DefaultAvatarStack />
      <AvatarStackLimit />
      <AvatarStackSize />
    </section>
  );
}
