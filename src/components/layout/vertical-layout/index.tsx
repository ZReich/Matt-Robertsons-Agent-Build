import React from "react";

import { Dictionary } from "@/lib/getDictionary";

import { Sidebar } from "./sidebar";
import { Footer } from "./footer";
import { Header } from "./header";

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
      <div className="flex-1">
        <Header dictionary={dictionary} />
        <main>{children}</main>
        <Footer />
      </div>
    </div>
  );
}
