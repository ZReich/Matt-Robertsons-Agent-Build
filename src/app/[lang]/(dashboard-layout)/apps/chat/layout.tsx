import { getChatsData } from "./_actions/get-chats-data";
import { ChatSidebar } from "./_components/chat-sidebar";
import { ChatProvider } from "./contexts/chat-context";
import { ChatType } from "./types";

export default async function ChatLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const chatsData: ChatType[] = await getChatsData();

  return (
    <ChatProvider chatsData={chatsData}>
      <div className="container relative w-full flex gap-x-4 p-4">
        <ChatSidebar />
        {children}
      </div>
    </ChatProvider>
  );
}
