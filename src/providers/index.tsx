import type { Direction } from "@/types";
import type { Session } from "next-auth";

import { SettingsProvider } from "./settings-provider";
import { CustomThemeProvider } from "./custom-theme-provider";
import { ThemeProvider } from "./theme-provider";
import { NextAuthProvider } from "./next-auth-provider";

export default function Providers({
  session,
  direction,
  children,
}: Readonly<{
  session: Session | null;
  direction: Direction;
  children: React.ReactNode;
}>) {
  return (
    <SettingsProvider direction={direction}>
      <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
        <CustomThemeProvider>
          <NextAuthProvider session={session}>{children}</NextAuthProvider>
        </CustomThemeProvider>
      </ThemeProvider>
    </SettingsProvider>
  );
}
