"use client";

import { useMedia } from "react-use";

import { useChatContext } from "../../hooks/use-chat-context";

import { Sheet, SheetContent } from "@/components/ui/sheet";
import { Card } from "@/components/ui/card";
import { ChatSidebarHeader } from "./chat-sidebar-header";
import { ChatList } from "./chat-list";

export function ChatSidebar() {
  const { isChatSidebarOpen, setIsChatSidebarOpen } = useChatContext();
  const isMobile = useMedia("(max-width: 767px)");

  const content = (
    <div className="md:w-72">
      <ChatSidebarHeader />
      <ChatList />
    </div>
  );

  if (!isMobile) {
    setIsChatSidebarOpen(false);

    return (
      <aside>
        <Card>{content}</Card>
      </aside>
    );
  }

  return (
    <Sheet open={isChatSidebarOpen} onOpenChange={setIsChatSidebarOpen}>
      <SheetContent side="dir">{content}</SheetContent>
    </Sheet>
  );
}
