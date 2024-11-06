import { Dictionary } from "@/lib/getDictionary";

import { Sidebar } from "./sidebar";
import { Footer } from "../footer";
import { Header } from "./header";

export default function VerticalLayout({
  children,
  dictionary,
}: {
  children: React.ReactNode;
  dictionary: Dictionary;
}) {
  return (
    <div className="min-h-screen w-full grid bg-background md:grid-cols-[auto,_1fr]">
      <Sidebar />
      <div className="w-full grid md:grid-rows-[auto,_1fr,_auto]">
        <Header dictionary={dictionary} />
        <main className="bg-muted/40 overflow-x-hidden">{children}</main>
        <Footer />
      </div>
    </div>
  );
}
