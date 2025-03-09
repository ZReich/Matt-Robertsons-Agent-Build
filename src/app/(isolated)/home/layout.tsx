import { HomeLayout as Layout } from "./_components/home-layout"

export default function HomeLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return <Layout>{children}</Layout>
}
