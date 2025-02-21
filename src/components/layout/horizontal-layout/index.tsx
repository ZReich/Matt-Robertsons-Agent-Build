import type { DictionaryType } from "@/lib/getDictionary";

import { HorizontalLayoutHeader } from "./horizontal-layout-header";
import { Footer } from "../footer";
import { Sidebar } from "../sidebar";

export default function HorizontalLayout({
  children,
  dictionary,
}: {
  children: React.ReactNode;
  dictionary: DictionaryType;
}) {
  return (
    <div className="container relative flex justify-center p-0 border border-sidebar-border">
      <Sidebar dictionary={dictionary} />
      <div className="min-h-screen w-full grid md:grid-rows-[auto,_1fr,_auto]">
        <HorizontalLayoutHeader dictionary={dictionary} />
        <main className="min-h-[calc(100vh-9.553rem)] bg-muted/40 overflow-x-hidden">
          {children}
        </main>
        <Footer />
      </div>
    </div>
  );
}
