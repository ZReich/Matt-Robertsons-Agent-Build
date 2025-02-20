import { LandingLayout as Layout } from "./_components/landing-layout";

export default function LandingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <Layout>{children}</Layout>;
}
