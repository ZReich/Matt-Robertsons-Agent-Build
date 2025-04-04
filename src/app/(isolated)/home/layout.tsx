import type { ReactNode } from "react"

import { HomeLayout as Layout } from "./_components/home-layout"

export default function HomeLayout({ children }: { children: ReactNode }) {
  return <Layout>{children}</Layout>
}
