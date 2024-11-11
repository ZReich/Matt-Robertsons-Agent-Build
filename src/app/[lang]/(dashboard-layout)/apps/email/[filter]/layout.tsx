import { Sidebar } from "../_components/email-sidebar";

export default function EmailLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="container h-full w-full flex gap-4 p-4">
      <Sidebar />
      {children}
    </div>
  );
}
