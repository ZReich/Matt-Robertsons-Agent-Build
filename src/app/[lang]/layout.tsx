import { Lato, Cairo } from "next/font/google";

import { i18n } from "@/configs/i18n";

import { cn } from "@/lib/utils";
import { getDictionary } from "@/lib/getDictionary";

import "../globals.css";

import type { Metadata } from "next";
import type { Locale } from "@/configs/i18n";

import Providers from "@/providers";
import { Toaster } from "@/components/ui/toaster";
import VerticalLayout from "@/components/layout/vertical-layout";
import Layout from "@/components/layout";

export const metadata: Metadata = {
  title: {
    template: "%s | Shadboard",
    default: "Shadboard",
  },
  description: "",
  metadataBase: new URL("http://localhost:3000/"),
};

const latoFont = Lato({
  subsets: ["latin"],
  weight: ["100", "300", "400", "700", "900"],
  style: ["normal", "italic"],
  variable: "--font-lato",
});
const cairoFont = Cairo({
  subsets: ["arabic"],
  weight: ["400", "700"],
  style: ["normal"],
  variable: "--font-cario",
});

export default async function RootLayout({
  children,
  params,
}: Readonly<{
  children: React.ReactNode;
  params: { lang: Locale };
}>) {
  const direction = i18n.langDirection[params.lang];
  const dictionary = await getDictionary(params.lang);

  return (
    <html lang={params.lang} dir={direction} suppressHydrationWarning>
      <body
        className={cn(
          "[&:lang(en)]:font-lato [&:lang(ar)]:font-cario",
          "bg-background antialiased",
          latoFont.variable,
          cairoFont.variable
        )}
      >
        <Providers>
          <Layout dictionary={dictionary}>{children}</Layout>
          <Toaster />
        </Providers>
      </body>
    </html>
  );
}
