import type { ReactNode } from "react"

import { Footer } from "./footer"
import { Header } from "./header"

export function HomeLayout({ children }: { children: ReactNode }) {
  return (
    <div className="grow">
      <Header />
      <main>{children}</main>
      <Footer />
    </div>
  )
}
