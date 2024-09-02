import { SidebarContent } from "../sidebar-content";

export function Sidebar() {
  return (
    <aside className="hidden h-screen w-64 sticky top-0 start-0 p-5 space-y-2 md:block">
      <SidebarContent />
    </aside>
  );
}
