import type { Metadata } from "next";

import { DocsBreadcrumb } from "./_components/docs-breadcrumb";
import { Toc } from "./_components/toc";
import { DocsSidebar } from "./_components/docs-sidebar";
import { DocsPagination } from "./_components/docs-pagination";
import { Header } from "./_components/header";
import { Footer } from "./_components/footer";
import { Separator } from "@/components/ui/separator";

// Define metadata for the application
// More info: https://nextjs.org/docs/app/building-your-application/optimizing/metadata
export const metadata: Metadata = {
  title: "Documentation",
};

export default async function DocsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="w-screen">
      <Header />
      <div className="relative grid grid-cols-[auto_1fr_auto]">
        <DocsSidebar />
        <main className="grid bg-muted/40 border-x border-b border-sidebar-border">
          <Separator className="sticky z-50 top-[4.25rem] hidden w-full h-[0.5px] md:block" />
          <div className="justify-self-center p-4 z-10">
            <DocsBreadcrumb />
            <div
              id="mdx-content"
              className="prose prose-headings:mt-8 prose-headings:font-semibold prose-headings:text-foreground prose-h1:text-5xl prose-h2:text-4xl prose-h3:text-3xl prose-h4:text-2xl prose-h5:text-xl prose-h6:text-lg prose-strong:text-foreground prose-code:text-foreground prose-a:text-foreground prose-pre:bg-muted text-foreground"
            >
              {children}
            </div>
            <DocsPagination />
          </div>
        </main>
        <Toc />
      </div>
      <Footer />
    </div>
  );
}
