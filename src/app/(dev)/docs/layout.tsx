import type { Metadata } from "next";

import { DocsBreadcrumb } from "./_components/docs-breadcrumb";
import { Toc } from "./_components/toc";
import { DocsSidebar } from "./_components/docs-sidebar";
import { DocsPagination } from "./_components/docs-pagination";
import { Header } from "./_components/header";
import { Footer } from "./_components/footer";

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
    <div className="container relative p-0">
      <Header />
      <div className="sticky top-0 w-full flex justify-between">
        <DocsSidebar />
        <Toc />
      </div>
      <main className="h-full w-full flex flex-col items-center p-4 pt-20 bg-muted/40 lg:-mt-[100svh]">
        <div className="z-10 lg:mx-64">
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
      <Footer />
    </div>
  );
}
