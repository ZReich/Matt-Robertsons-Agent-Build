import { Dictionary } from "@/lib/getDictionary";

import { Header } from "./header";
import { Footer } from "../footer";

export default function HorizontalLayout({
  children,
  dictionary,
}: {
  children: React.ReactNode;
  dictionary: Dictionary;
}) {
  return (
    <div className="min-h-screen w-full grid grid-rows-[auto,_1fr,_auto] bg-background">
      <Header dictionary={dictionary} />
      <main className="bg-muted/40  overflow-x-hidden">{children}</main>
      <Footer />
    </div>
  );
}
