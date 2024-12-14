import type { DictionaryType } from "@/lib/getDictionary";

import { Header } from "./header";
import { Footer } from "../footer";

export default function HorizontalLayout({
  children,
  dictionary,
}: {
  children: React.ReactNode;
  dictionary: DictionaryType;
}) {
  return (
    <div className="min-h-screen w-full grid md:grid-rows-[auto,_1fr,_auto]">
      <Header dictionary={dictionary} />
      <main className="min-h-[calc(100vh-9.553rem)] bg-muted/40 overflow-x-hidden">
        {children}
      </main>
      <Footer />
    </div>
  );
}
