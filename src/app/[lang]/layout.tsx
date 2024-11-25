import { Lato, Cairo } from "next/font/google";
import { getServerSession } from "next-auth";

import { i18n } from "@/configs/i18n";
import { nextAuthOptions } from "@/configs/next-auth";

import { cn } from "@/lib/utils";

import "../globals.css";

import type { Metadata } from "next";
import type { LocaleType } from "@/configs/i18n";

import Providers from "@/providers";
import { Toaster } from "@/components/ui/toaster";

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
  params: { lang: LocaleType };
}>) {
  const session = await getServerSession(nextAuthOptions);
  const direction = i18n.langDirection[params.lang];

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
        <Providers direction={direction} session={session}>
          {children}
          <Toaster />
        </Providers>
      </body>
    </html>
  );
}
