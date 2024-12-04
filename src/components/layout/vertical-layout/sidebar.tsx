import { SidebarContent } from "../sidebar-content";

export function Sidebar() {
  return (
    <aside className="hidden h-screen w-64 sticky top-0 start-0 bg-background p-2 space-y-2 border-e-[1px] border-accent overflow-hidden md:block">
      <SidebarContent />
    </aside>
  );
}
