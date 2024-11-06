import { useParams } from "next/navigation";

import { useChatContext } from "../../hooks/use-chat-context";

import { ScrollArea } from "@/components/ui/scroll-area";
import { ChatListItem } from "./chat-list-item";

export function ChatList() {
  const { chatState, setIsChatSidebarOpen } = useChatContext();
  const params = useParams();

  const chats = chatState.chats;
  const chatIdParam = params.id?.[0];

  return (
    <ScrollArea className="h-[calc(100vh-5.5rem)] md:h-[calc(100vh-15.825rem)]">
      <ul className="p-3 space-y-1.5">
        {chats.map((chat) => {
          return (
            <ChatListItem
              key={chat.id}
              chat={chat}
              chatIdParam={chatIdParam}
              setIsChatSidebarOpen={setIsChatSidebarOpen}
            />
          );
        })}
      </ul>
    </ScrollArea>
  );
}
