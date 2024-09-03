import { Dictionary } from "@/lib/getDictionary";

import { Sidebar } from "./sidebar";
import { Footer } from "./footer";
import { Header } from "./header";
import { Customizer } from "@/components/customizer";

export default function VerticalLayout({
  children,
  dictionary,
}: {
  children: React.ReactNode;
  dictionary: Dictionary;
}) {
  return (
    <div className="min-h-screen w-full flex bg-background">
      <Sidebar />
      <Customizer />
      <div className="flex-1">
        <Header dictionary={dictionary} />
        <main>{children}</main>
        <Footer />
      </div>
    </div>
  );
}
