import { SettingsProvider } from "./settings-provider";
import { CustomThemeProvider } from "./custom-theme-provider";
import { ThemeProvider } from "./theme-provider";

export default function Providers({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <SettingsProvider>
      <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
        <CustomThemeProvider>{children}</CustomThemeProvider>
      </ThemeProvider>
    </SettingsProvider>
  );
}
