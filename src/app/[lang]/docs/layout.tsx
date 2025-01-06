import type { LocaleType } from "@/types";

import { DocsBreadcrumb } from "./_components/docs-breadcrumb";
import { Toc } from "./_components/toc";
import { DocsSidebar } from "./_components/docs-sidebar";
import { SidebarProvider } from "@/components/ui/sidebar";
import { DocsPagination } from "./_components/docs-pagination";
import { sidebarNavigation } from "./_data/sidebar-navigation";
import { Header } from "./_components/header";

export default async function DashboardLayout({
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
        <DocsSidebar items={sidebarNavigation} />
        <main className="mt-16 p-4">
          <DocsBreadcrumb />
          <div
            id="mdx-content"
            className="prose prose-headings:mt-8 prose-headings:font-semibold prose-headings:text-foreground prose-h1:text-5xl prose-h2:text-4xl prose-h3:text-3xl prose-h4:text-2xl prose-h5:text-xl prose-h6:text-lg text-foreground"
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
