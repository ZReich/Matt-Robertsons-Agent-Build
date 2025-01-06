import { Lato, Cairo } from "next/font/google";
import { getServerSession } from "next-auth";

import { i18n } from "@/configs/i18n";
import { authOptions } from "@/configs/next-auth";

import { cn } from "@/lib/utils";

import "../globals.css";

import type { Metadata } from "next";
import type { LocaleType } from "@/types";

import Providers from "@/providers";

import { Toaster } from "@/components/ui/toaster";

// Define metadata for the application
// More info: https://nextjs.org/docs/app/building-your-application/optimizing/metadata
export const metadata: Metadata = {
  title: {
    template: "%s | Shadboard",
    default: "Shadboard",
  },
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
const cairoFont = Cairo({
  subsets: ["arabic"],
  weight: ["400", "700"],
  style: ["normal"],
  variable: "--font-cario",
});

export default async function RootLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: { lang: LocaleType };
}) {
  const session = await getServerSession(authOptions);
  const direction = i18n.langDirection[params.lang];

  return (
    <html lang={params.lang} dir={direction} suppressHydrationWarning>
      <body
        className={cn(
          "[&:lang(en)]:font-lato [&:lang(ar)]:font-cario", // Set font styles based on the language
          "bg-background text-foreground antialiased", // Set background, text, and anti-aliasing styles
          latoFont.variable, // Include Lato font variable
          cairoFont.variable // Include Cairo font variable
        )}
      >
        <Providers locale={params.lang} direction={direction} session={session}>
          {children}
          <Toaster />
        </Providers>
      </body>
    </html>
  );
}
