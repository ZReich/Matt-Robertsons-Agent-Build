import { Sidebar } from "../_components/email-sidebar";

export default function EmailLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex h-full bg-background">
      <Sidebar />
      <div className="flex-1 flex">{children}</div>
    </div>
  );
}
