import { Lato } from "next/font/google";

import { cn } from "@/lib/utils";

import "../globals.css";

import type { Metadata } from "next";

import { Providers } from "@/providers";

import { DocsBreadcrumb } from "./_components/docs-breadcrumb";
import { Toc } from "./_components/toc";
import { DocsSidebar } from "./_components/docs-sidebar";
import { DocsPagination } from "./_components/docs-pagination";
import { Header } from "./_components/header";
import { Footer } from "./_components/footer";

// Define metadata for the application
// More info: https://nextjs.org/docs/app/building-your-application/optimizing/metadata
export const metadata: Metadata = {
  title: "Documentation | Shadboard",
  description: "",
  metadataBase: new URL(process.env.BASE_URL as string),
};

// Define fonts for the application
// More info: https://nextjs.org/docs/app/building-your-application/optimizing/fonts
const latoFont = Lato({
  subsets: ["latin"],
  weight: ["100", "300", "400", "700", "900"],
  style: ["normal", "italic"],
  variable: "--font-lato",
});

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={cn(
          "[&:lang(en)]:font-lato", // Set font styles based on the language
          "bg-background text-foreground antialiased overscroll-none", // Set background, text, , anti-aliasing styles, and overscroll behavior
          latoFont.variable // Include Lato font variable
        )}
      >
        <Providers locale="en" direction="ltr" session={null}>
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
        </Providers>
      </body>
    </html>
  );
}
