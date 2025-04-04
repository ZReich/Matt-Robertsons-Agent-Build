import type { DictionaryType } from "@/lib/get-dictionary"
import type { ReactNode } from "react"

import { Footer } from "../footer"
import { Sidebar } from "../sidebar"
import { VerticalLayoutHeader } from "./vertical-layout-header"

export function VerticalLayout({
  children,
  dictionary,
}: {
  children: ReactNode
  dictionary: DictionaryType
}) {
  return (
    <>
      <Sidebar dictionary={dictionary} />
      <div className="min-h-screen w-full grid">
        <div className="w-full grid md:grid-rows-[auto__1fr__auto]">
          <VerticalLayoutHeader dictionary={dictionary} />
          <main className="min-h-[calc(100vh-6.771rem)] bg-muted/40 border-x border-b border-sidebar-border overflow-x-hidden">
            {children}
          </main>
          <Footer />
        </div>
      </div>
    </>
  )
}
