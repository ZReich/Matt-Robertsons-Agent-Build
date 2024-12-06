import { getChatsData } from "./_actions/get-chats-data";

import type { Metadata } from "next";
import type { ChatType } from "./types";

import { ChatProvider } from "./contexts/chat-context";
import { ChatSidebar } from "./_components/chat-sidebar";

export const metadata: Metadata = {
  title: "Chat",
};

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
