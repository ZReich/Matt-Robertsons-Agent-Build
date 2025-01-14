import type { LocaleType } from "@/types";
import type { Metadata } from "next";

import { DocsBreadcrumb } from "./_components/docs-breadcrumb";
import { Toc } from "./_components/toc";
import { DocsSidebar } from "./_components/docs-sidebar";
import { SidebarProvider } from "@/components/ui/sidebar";
import { DocsPagination } from "./_components/docs-pagination";
import { Header } from "./_components/header";

// Define metadata for the page
// More info: https://nextjs.org/docs/app/building-your-application/optimizing/metadata
export const metadata: Metadata = {
  title: "Documentation",
};

export default async function DocsLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: { lang: LocaleType };
}) {
  return (
    <SidebarProvider>
      <div className="min-h-screen w-full flex justify-between">
        <Header locale={params.lang} />
        <DocsSidebar />
        <main className="mt-16 p-4">
          <DocsBreadcrumb />
          <div
            id="mdx-content"
            className="prose prose-headings:mt-8 prose-headings:font-semibold prose-headings:text-foreground prose-h1:text-5xl prose-h2:text-4xl prose-h3:text-3xl prose-h4:text-2xl prose-h5:text-xl prose-h6:text-lg prose-strong:text-foreground prose-code:text-foreground prose-a:text-foreground prose-pre:bg-muted text-foreground"
          >
            {children}
          </div>
          <DocsPagination />
        </main>
        <Toc />
      </div>
    </SidebarProvider>
  );
}
