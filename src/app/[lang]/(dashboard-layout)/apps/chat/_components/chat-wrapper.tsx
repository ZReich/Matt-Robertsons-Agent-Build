import type { ChatType } from "../types";

import { ChatProvider } from "../contexts/chat-context";
import { ChatSidebar } from "./chat-sidebar";

export function ChatWrapper({
  chatsData,
  children,
}: {
  chatsData: ChatType[];
  children: React.ReactNode;
}) {
  return (
    <ChatProvider chatsData={chatsData}>
      <div className="container relative w-full flex gap-x-4 p-4">
        <ChatSidebar />
        {children}
      </div>
    </ChatProvider>
  );
}
