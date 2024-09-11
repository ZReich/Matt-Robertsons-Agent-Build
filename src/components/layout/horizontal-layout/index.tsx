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
    <div className="min-h-screen w-full flex bg-background">
      <div className="flex-1">
        <Header dictionary={dictionary} />
        <main className="bg-muted/40">{children}</main>
        <Footer />
      </div>
    </div>
  );
}
