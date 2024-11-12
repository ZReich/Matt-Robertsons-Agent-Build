import { NavList } from "./_components/NavList";

export default function SettingsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="container grid w-full items-start gap-6 py-6 md:grid-cols-[180px_1fr]">
      <div className="grid gap-6">
        <h1 className="text-3xl font-semibold">Settings</h1>
        <NavList />
      </div>
      <div className="grid gap-6">{children}</div>
    </div>
  );
}
