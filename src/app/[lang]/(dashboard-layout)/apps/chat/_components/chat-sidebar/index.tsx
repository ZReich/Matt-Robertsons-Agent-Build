"use client";

import { useMedia } from "react-use";
import { Menu } from "lucide-react";

import { cn } from "@/lib/utils";

import { useChatContext } from "../../hooks/use-chat-context";

import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Card } from "@/components/ui/card";
import { ChatSidebarHeader } from "./chat-sidebar-header";
import { buttonVariants } from "@/components/ui/button";
import { ChatList } from "./chat-list";

export function ChatSidebar() {
  const { isChatSidebarOpen, setIsChatSidebarOpen } = useChatContext();
  const isMediumOrSmaller = useMedia("(max-width: 767px)");

  const content = (
    <div className="md:w-72">
      <ChatSidebarHeader />
      <ChatList />
    </div>
  );

  if (!isMediumOrSmaller) {
    return (
      <aside>
        <Card>{content}</Card>
      </aside>
    );
  }

  return (
    <Sheet open={isChatSidebarOpen} onOpenChange={setIsChatSidebarOpen}>
      <SheetTrigger
        className={cn(
          buttonVariants({ size: "icon" }),
          "fixed bottom-16 start-4 md:hidden"
        )}
        aria-label="Open chat sidebar"
      >
        <Menu className="h-4 w-4" />
      </SheetTrigger>
      <SheetContent side="dir">{content}</SheetContent>
    </Sheet>
  );
}
