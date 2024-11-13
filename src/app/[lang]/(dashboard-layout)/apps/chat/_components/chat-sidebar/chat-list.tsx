import { useChatContext } from "../../hooks/use-chat-context";

import { ScrollArea } from "@/components/ui/scroll-area";
import { ChatListItem } from "./chat-list-item";

export function ChatList() {
  const { chatState } = useChatContext();

  const chats = chatState.chats;

  return (
    <ScrollArea className="h-[calc(100vh-5.5rem)] md:h-[calc(100vh-15.825rem)]">
      <ul className="p-3 space-y-1.5">
        {chats.map((chat) => {
          return <ChatListItem key={chat.id} chat={chat} />;
        })}
      </ul>
    </ScrollArea>
  );
}
