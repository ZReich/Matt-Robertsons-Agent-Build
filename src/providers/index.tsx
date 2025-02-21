import type { Session } from "next-auth";
import type { DirectionType, LocaleType } from "@/types";

import { SettingsProvider } from "@/contexts/settings-context";
import { ModeProvider } from "./mode-provider";
import { ThemeProvider } from "./theme-provider";
import { NextAuthProvider } from "./next-auth-provider";
import { DirectionProvider } from "./direction-provider";
import { SidebarProvider } from "@/components/ui/sidebar";

export function Providers({
  session,
  locale,
  direction,
  children,
}: Readonly<{
  session: Session | null;
  locale: LocaleType;
  direction: DirectionType;
  children: React.ReactNode;
}>) {
  return (
    <SettingsProvider locale={locale}>
      <ModeProvider>
        <ThemeProvider>
          <DirectionProvider direction={direction}>
            <NextAuthProvider session={session}>
              <SidebarProvider>{children}</SidebarProvider>
            </NextAuthProvider>
          </DirectionProvider>
        </ThemeProvider>
      </ModeProvider>
    </SettingsProvider>
  );
}
