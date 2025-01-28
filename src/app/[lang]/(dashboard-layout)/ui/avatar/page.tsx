import type { Metadata } from "next";

import { DefaultAvatar } from "./_components/default-avatar";

// Define metadata for the page
// More info: https://nextjs.org/docs/app/building-your-application/optimizing/metadata
export const metadata: Metadata = {
  title: "Avatar",
};

export default function AvatarPage() {
  return (
    <section className="container grid gap-4 p-4 md:grid-cols-2">
      <DefaultAvatar />
    </section>
  );
}
