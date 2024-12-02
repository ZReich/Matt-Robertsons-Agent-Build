import type { DirectionType } from "@/types";
import type { Session } from "next-auth";

import { SettingsProvider } from "./settings-provider";
import { ModeProvider } from "./mode-provider";
import { ThemeProvider } from "./theme-provider";
import { NextAuthProvider } from "./next-auth-provider";
import { DirectionProvider } from "./direction-provider";

export default function Providers({
  session,
  direction,
  children,
}: Readonly<{
  session: Session | null;
  direction: DirectionType;
  children: React.ReactNode;
}>) {
  return (
    <SettingsProvider direction={direction}>
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
