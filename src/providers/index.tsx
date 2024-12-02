import { LocaleType } from "@/configs/i18n";
import type { Session } from "next-auth";

import { SettingsProvider } from "./settings-provider";
import { ModeProvider } from "./mode-provider";
import { ThemeProvider } from "./theme-provider";
import { NextAuthProvider } from "./next-auth-provider";
import { DirectionProvider } from "./direction-provider";

export default function Providers({
  session,
  locale,
  children,
}: Readonly<{
  session: Session | null;
  locale: LocaleType;
  children: React.ReactNode;
}>) {
  return (
    <SettingsProvider locale={locale}>
      <ModeProvider>
        <ThemeProvider>
          <DirectionProvider>
            <NextAuthProvider session={session}>{children}</NextAuthProvider>
          </DirectionProvider>
        </ThemeProvider>
      </ModeProvider>
    </SettingsProvider>
  );
}
